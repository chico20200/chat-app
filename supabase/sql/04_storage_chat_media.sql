-- =========================================================
-- 04_storage_chat_media.sql — imágenes y archivos del chat
-- Bucket PRIVADO: solo los miembros de la sala pueden subir y ver.
-- Ruta de cada archivo: chat-media/<roomId>/<uuid>-<nombre>
-- =========================================================

-- 1. ¿El usuario actual es miembro de esta sala? (recibe el roomId como texto
--    porque viene de la ruta del archivo)
create or replace function public.is_room_member(p_room_id text)
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

revoke all on function public.is_room_member(text) from public, anon;
grant execute on function public.is_room_member(text) to authenticated;

-- 2. Bucket privado, máx. 10 MB, imágenes y documentos comunes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media', 'chat-media', false, 10485760,
  array[
    'image/*',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

-- 3. Políticas
create policy "Chat media: los miembros suben a la carpeta de su sala"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and (select public.is_room_member((storage.foldername(name))[1]))
  );

create policy "Chat media: los miembros ven los archivos de su sala"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and (select public.is_room_member((storage.foldername(name))[1]))
  );

create policy "Chat media: cada autor borra sus archivos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and owner_id = (select auth.jwt() ->> 'sub')
  );
