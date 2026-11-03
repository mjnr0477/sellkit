-- Keep host presence fresh so abandoned live rooms can be closed safely.
alter table public.vybora_live_sessions
  add column if not exists heartbeat_at timestamptz not null default now();

create index if not exists vybora_live_sessions_stale_heartbeat_idx
  on public.vybora_live_sessions(heartbeat_at)
  where status = 'live';

-- Atomic cleanup prevents a heartbeat arriving during cleanup from ending a live room.
create or replace function public.vybora_cleanup_stale_live_sessions(p_stale_before timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
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
