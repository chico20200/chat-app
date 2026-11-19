-- =========================================================
-- 01_profiles.sql — perfiles de usuario (id = uid de Firebase)
-- =========================================================

-- 1. Tabla
create table public.profiles (
  id            text primary key default (auth.jwt() ->> 'sub'),
  display_name  text not null check (char_length(display_name) between 1 and 40),
  bio           text not null default '' check (char_length(bio) <= 160),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Privilegios: solo usuarios autenticados, y nunca DELETE
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- 3. Activar RLS (sin políticas = nadie ve nada)
alter table public.profiles enable row level security;

-- 4. Políticas
create policy "Perfiles visibles para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Cada usuario crea solo su propio perfil"
  on public.profiles for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = id);

create policy "Cada usuario edita solo su propio perfil"
  on public.profiles for update
  to authenticated
  using      ((select auth.jwt() ->> 'sub') = id)
  with check ((select auth.jwt() ->> 'sub') = id);

-- 5. updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();