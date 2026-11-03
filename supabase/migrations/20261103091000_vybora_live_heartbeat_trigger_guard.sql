-- Replace the public SECURITY DEFINER heartbeat RPC with an invoker trigger.
-- The trigger overwrites client-supplied timestamps with the database clock.
revoke all on function public.vybora_touch_live_session(uuid) from public, anon, authenticated;
drop function if exists public.vybora_touch_live_session(uuid);

grant update (status, ended_at, heartbeat_at)
  on public.vybora_live_sessions to authenticated;

create or replace function public.vybora_guard_live_heartbeat()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $heartbeat$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and auth.uid() <> new.host_id then
      raise exception using errcode = '42501',
        message = 'Only the session host can create a live heartbeat';
    end if;
    if auth.uid() is not null then
      new.heartbeat_at := clock_timestamp();
    end if;
    return new;
  end if;

  if new.heartbeat_at is distinct from old.heartbeat_at then
    if auth.uid() is null or auth.uid() <> old.host_id then
      raise exception using errcode = '42501',
        message = 'Only the session host can refresh a live heartbeat';
    end if;
    new.heartbeat_at := clock_timestamp();
  end if;

  return new;
end;
$heartbeat$;

revoke all on function public.vybora_guard_live_heartbeat() from public, anon, authenticated;

drop trigger if exists vybora_live_heartbeat_guard on public.vybora_live_sessions;
create trigger vybora_live_heartbeat_guard
before insert or update on public.vybora_live_sessions
for each row execute function public.vybora_guard_live_heartbeat();
