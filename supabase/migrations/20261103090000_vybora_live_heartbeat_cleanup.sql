-- Keep host presence fresh so abandoned live rooms can be closed safely.
alter table public.vybora_live_sessions
  add column if not exists heartbeat_at timestamptz not null default now();

create index if not exists vybora_live_sessions_stale_heartbeat_idx
  on public.vybora_live_sessions(heartbeat_at)
  where status = 'live';

-- Clients may end their own room, but only this ownership-checked RPC may refresh presence.
revoke update on public.vybora_live_sessions from authenticated;
grant update (status, ended_at) on public.vybora_live_sessions to authenticated;

create or replace function public.vybora_touch_live_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $touch$
begin
  update public.vybora_live_sessions
     set heartbeat_at = clock_timestamp()
   where id = p_session_id
     and host_id = (select auth.uid())
     and status = 'live';
  return found;
end;
$touch$;

revoke all on function public.vybora_touch_live_session(uuid) from public, anon;
grant execute on function public.vybora_touch_live_session(uuid) to authenticated;

-- Atomic cleanup prevents a heartbeat arriving during cleanup from ending a live room.
create or replace function public.vybora_cleanup_stale_live_sessions(p_stale_before timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  with stale as (
    update public.vybora_live_sessions
       set status = 'ended', ended_at = now()
     where status = 'live'
       and heartbeat_at < p_stale_before
    returning id
  ),
  removed_participants as (
    delete from public.vybora_live_participants p
     using stale s
     where p.session_id = s.id
    returning 1
  ),
  removed_signals as (
    delete from public.vybora_live_signals x
     using stale s
     where x.session_id = s.id
    returning 1
  )
  select jsonb_build_object(
    'endedSessions', (select count(*) from stale),
    'removedParticipants', (select count(*) from removed_participants),
    'removedSignals', (select count(*) from removed_signals)
  ) into result;

  return result;
end;
$$;

revoke all on function public.vybora_cleanup_stale_live_sessions(timestamptz) from public, anon, authenticated;
grant execute on function public.vybora_cleanup_stale_live_sessions(timestamptz) to service_role;
