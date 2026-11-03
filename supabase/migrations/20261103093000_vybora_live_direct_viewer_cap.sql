-- The current browser live transport is host-to-viewer WebRTC (one peer per viewer).
-- Cap direct rooms at three viewers until an SFU media relay is integrated.
create or replace function public.vybora_guard_live_participant_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $capacity$
declare
  v_host_id uuid;
  v_status text;
  v_viewer_count integer;
begin
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception using errcode = '42501',
      message = 'Live participant must match the signed-in user';
  end if;

  select host_id, status, viewer_count
    into v_host_id, v_status, v_viewer_count
    from public.vybora_live_sessions
   where id = new.session_id
   for update;

  if not found or v_status <> 'live' then
    raise exception using errcode = '42501',
      message = 'This live room is no longer active';
  end if;

  if new.user_id <> v_host_id and v_viewer_count >= 3 then
    raise exception using errcode = 'P0001',
      message = 'Live room is full; this direct-stream room supports up to three viewers';
  end if;

  return new;
end;
$capacity$;

revoke all on function public.vybora_guard_live_participant_capacity() from public, anon, authenticated;
drop trigger if exists vybora_live_participant_capacity_guard on public.vybora_live_participants;
create trigger vybora_live_participant_capacity_guard
before insert on public.vybora_live_participants
for each row execute function public.vybora_guard_live_participant_capacity();

-- This restrictive policy ANDs with the existing permissive membership/block policies.
drop policy if exists "VYBORA direct live viewer capacity" on public.vybora_live_participants;
create policy "VYBORA direct live viewer capacity"
  on public.vybora_live_participants
  as restrictive
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.vybora_live_sessions s
       where s.id = session_id
         and s.status = 'live'
         and (s.host_id = (select auth.uid()) or s.viewer_count < 3)
    )
  );
