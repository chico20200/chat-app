-- =========================================================
-- 02_storage_avatars.sql — bucket de fotos de perfil
-- Ruta de cada archivo: avatars/<uid de Firebase>/avatar.<ext>
-- =========================================================

-- 1. Bucket público, máx. 1 MB, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- 2. Políticas: cada usuario solo opera dentro de SU carpeta
create policy "Avatares: subir a la carpeta propia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Avatares: ver la carpeta propia"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Avatares: reemplazar en la carpeta propia"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Avatares: borrar de la carpeta propia"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );