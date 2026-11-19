-- =========================================================
-- 05_private_helpers.sql — mover las funciones auxiliares de RLS a un esquema privado
-- El esquema "private" NO está expuesto por la API de Supabase, así que estas
-- funciones ya no se pueden llamar como /rest/v1/rpc/... desde internet,
-- pero las políticas RLS sí pueden usarlas.
-- =========================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_view_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (
        (r.type = 'group' and not r.is_private)
        or exists (
          select 1 from public.room_members m
          where m.room_id = r.id
            and m.user_id = (select auth.jwt() ->> 'sub')
        )
      )
  );
$$;

create or replace function private.is_room_member(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id::text = p_room_id
      and m.user_id = (select auth.jwt() ->> 'sub')
  );
$$;

revoke all on function private.can_view_room(uuid) from public, anon;
revoke all on function private.is_room_member(text) from public, anon;
grant execute on function private.can_view_room(uuid) to authenticated;
grant execute on function private.is_room_member(text) to authenticated;

-- Las políticas pasan a usar las funciones privadas
alter policy "Ver salas públicas o donde soy miembro" on public.rooms
  using ((select private.can_view_room(id)));

alter policy "Ver miembros de las salas que puedo ver" on public.room_members
  using ((select private.can_view_room(room_id)));

alter policy "Chat media: los miembros suben a la carpeta de su sala" on storage.objects
  with check (
    bucket_id = 'chat-media'
    and (select private.is_room_member((storage.foldername(name))[1]))
  );

alter policy "Chat media: los miembros ven los archivos de su sala" on storage.objects
  using (
    bucket_id = 'chat-media'
    and (select private.is_room_member((storage.foldername(name))[1]))
  );

-- Las versiones públicas ya no se usan
drop function public.can_view_room(uuid);
drop function public.is_room_member(text);
