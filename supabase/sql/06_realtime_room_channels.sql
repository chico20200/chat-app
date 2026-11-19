-- =========================================================
-- 06_realtime_room_channels.sql — canales privados de Realtime por sala
-- Cada sala usa el canal "room:<roomId>" para presencia (quién está en línea)
-- y broadcast (evento "typing"). Solo sus miembros pueden escuchar y enviar.
-- =========================================================

create or replace function private.room_id_from_topic(p_topic text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_topic like 'room:%' then substring(p_topic from 6) else null end;
$$;

grant execute on function private.room_id_from_topic(text) to authenticated;

create policy "Realtime: los miembros escuchan el canal de su sala"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select private.is_room_member(private.room_id_from_topic((select realtime.topic()))))
  );

create policy "Realtime: los miembros envían al canal de su sala"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select private.is_room_member(private.room_id_from_topic((select realtime.topic()))))
  );
