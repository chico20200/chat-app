-- =========================================================
-- 03_rooms.sql — salas y miembros
-- Lecturas: directas desde la app, filtradas por RLS.
-- Escrituras: SOLO a través de la Edge Function "rooms".
-- =========================================================

-- 1. Salas
create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default 'group' check (type in ('group', 'direct')),
  name         text check (type = 'direct' or char_length(name) between 1 and 50),
  description  text not null default '' check (char_length(description) <= 200),
  is_private   boolean not null default false,
  dm_key       text unique,
  created_by   text not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  check (type = 'group' or (is_private and dm_key is not null))
);

-- 2. Miembros (tabla intermedia N:M entre rooms y profiles)
create table public.room_members (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    text not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_id_idx on public.room_members (user_id);

-- 3. Función auxiliar: ¿el usuario actual puede ver esta sala?
create or replace function public.can_view_room(p_room_id uuid)
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

-- 4. Privilegios: la app SOLO lee
revoke all on public.rooms, public.room_members from anon, authenticated;
grant select on public.rooms, public.room_members to authenticated;
revoke all on function public.can_view_room(uuid) from public, anon;
grant execute on function public.can_view_room(uuid) to authenticated;

-- 5. RLS
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

create policy "Ver salas públicas o donde soy miembro"
  on public.rooms for select
  to authenticated
  using ((select public.can_view_room(id)));

create policy "Ver miembros de las salas que puedo ver"
  on public.room_members for select
  to authenticated
  using ((select public.can_view_room(room_id)));