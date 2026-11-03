-- Keep participant membership briefly after stale-room termination so
-- Realtime can authorize and deliver the terminal status update to viewers.
create or replace function public.vybora_cleanup_stale_live_sessions(p_stale_before timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $cleanup$
declare
  v_session_id uuid;
  v_ended integer := 0;
  v_participants integer := 0;
  v_signals integer := 0;
  v_chat integer := 0;
  v_rows integer;
begin
  for v_session_id in
    select id from public.vybora_live_sessions
     where status = 'live' and heartbeat_at < p_stale_before
     for update
  loop
    update public.vybora_live_sessions
       set status = 'ended', ended_at = now(), viewer_count = 0
     where id = v_session_id;
    v_ended := v_ended + 1;

    -- Retain participant rows for a grace window so each viewer remains
    -- authorized to receive the session's ended event and clean up locally.
    delete from public.vybora_live_signals where session_id = v_session_id;
    get diagnostics v_rows = row_count;
    v_signals := v_signals + v_rows;

    delete from public.vybora_live_chat_messages where session_id = v_session_id;
    get diagnostics v_rows = row_count;
    v_chat := v_chat + v_rows;
  end loop;

  -- Reclaim participants left behind by clients that never received the
  -- terminal event. The ten-minute cleanup schedule gives a 20-minute grace.
  delete from public.vybora_live_participants p
   using public.vybora_live_sessions s
   where p.session_id = s.id
     and s.status = 'ended'
     and s.ended_at < now() - interval '20 minutes';
  get diagnostics v_rows = row_count;
  v_participants := v_rows;

  return jsonb_build_object(
    'endedSessions', v_ended,
    'removedParticipants', v_participants,
    'removedSignals', v_signals,
    'removedChatMessages', v_chat
  );
end;
$cleanup$;

revoke all on function public.vybora_cleanup_stale_live_sessions(timestamptz) from public, anon, authenticated;
grant execute on function public.vybora_cleanup_stale_live_sessions(timestamptz) to service_role;

drop policy if exists "Live participants send live chat" on public.vybora_live_chat_messages;
create policy "Live participants send live chat"
  on public.vybora_live_chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
        from public.vybora_live_participants p
        join public.vybora_live_sessions s on s.id = p.session_id
       where p.session_id = vybora_live_chat_messages.session_id
         and p.user_id = (select auth.uid())
         and s.status = 'live'
    )
  );

create index if not exists vybora_live_sessions_ended_at_idx
  on public.vybora_live_sessions(ended_at)
  where status = 'ended';
