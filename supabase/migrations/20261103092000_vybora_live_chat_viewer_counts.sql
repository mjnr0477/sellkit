-- Add lightweight live audience counts and participant-only live chat.
alter table public.vybora_live_sessions
  add column if not exists viewer_count integer not null default 0
  check (viewer_count >= 0);

update public.vybora_live_sessions s
   set viewer_count = (
     select count(*)::integer
       from public.vybora_live_participants p
      where p.session_id = s.id
        and p.user_id <> s.host_id
   );

-- SECURITY DEFINER helper avoids a circular RLS dependency:
-- live-session SELECT -> participants SELECT -> live-session SELECT.
create or replace function public.vybora_is_live_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $participant$
  select exists (
    select 1
      from public.vybora_live_participants p
     where p.session_id = p_session_id
       and p.user_id = auth.uid()
  );
$participant$;

revoke all on function public.vybora_is_live_participant(uuid) from public, anon;
grant execute on function public.vybora_is_live_participant(uuid) to authenticated;

drop policy if exists "Vybora active live sessions are public" on public.vybora_live_sessions;
create policy "Vybora active live sessions are public"
  on public.vybora_live_sessions for select to anon, authenticated
  using (
    status = 'live'
    or host_id = (select auth.uid())
    or (auth.uid() is not null and public.vybora_is_live_participant(id))
  );

create or replace function public.vybora_zero_live_viewer_count_on_end()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $zero_viewers$
begin
  if old.status = 'live' and new.status = 'ended' then
    new.viewer_count := 0;
  end if;
  return new;
end;
$zero_viewers$;

revoke all on function public.vybora_zero_live_viewer_count_on_end() from public, anon, authenticated;
drop trigger if exists vybora_zero_viewer_count_on_end on public.vybora_live_sessions;
create trigger vybora_zero_viewer_count_on_end
before update of status on public.vybora_live_sessions
for each row execute function public.vybora_zero_live_viewer_count_on_end();

create or replace function public.vybora_update_live_viewer_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $viewer_count$
declare
  v_session_id uuid;
  v_user_id uuid;
  v_delta integer;
  v_host_id uuid;
  v_status text;
begin
  if tg_op = 'INSERT' then
    v_session_id := new.session_id;
    v_user_id := new.user_id;
    v_delta := 1;
  else
    v_session_id := old.session_id;
    v_user_id := old.user_id;
    v_delta := -1;
  end if;

  select host_id, status into v_host_id, v_status
    from public.vybora_live_sessions
   where id = v_session_id;

  if v_status = 'live' and v_host_id is not null and v_user_id <> v_host_id then
    update public.vybora_live_sessions
       set viewer_count = greatest(0, viewer_count + v_delta)
     where id = v_session_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$viewer_count$;

revoke all on function public.vybora_update_live_viewer_count() from public, anon, authenticated;
drop trigger if exists vybora_live_viewer_count_change on public.vybora_live_participants;
create trigger vybora_live_viewer_count_change
after insert or delete on public.vybora_live_participants
for each row execute function public.vybora_update_live_viewer_count();

-- Purge chat with abandoned live rooms after the 30-minute heartbeat grace period.
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
  -- Process each room in order so row triggers see status='ended'
  -- before participant deletions can affect viewer counts.
  for v_session_id in
    select id from public.vybora_live_sessions
     where status = 'live' and heartbeat_at < p_stale_before
     for update
  loop
    update public.vybora_live_sessions
       set status = 'ended', ended_at = now(), viewer_count = 0
     where id = v_session_id;
    v_ended := v_ended + 1;

    delete from public.vybora_live_participants where session_id = v_session_id;
    get diagnostics v_rows = row_count;
    v_participants := v_participants + v_rows;

    delete from public.vybora_live_signals where session_id = v_session_id;
    get diagnostics v_rows = row_count;
    v_signals := v_signals + v_rows;

    delete from public.vybora_live_chat_messages where session_id = v_session_id;
    get diagnostics v_rows = row_count;
    v_chat := v_chat + v_rows;
  end loop;

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

create table if not exists public.vybora_live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vybora_live_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists vybora_live_chat_session_created_idx
  on public.vybora_live_chat_messages(session_id, created_at desc);

alter table public.vybora_live_chat_messages enable row level security;
grant select, insert, delete on public.vybora_live_chat_messages to authenticated;

drop policy if exists "Live participants read live chat" on public.vybora_live_chat_messages;
create policy "Live participants read live chat"
  on public.vybora_live_chat_messages for select to authenticated
  using (exists (
    select 1 from public.vybora_live_participants p
     where p.session_id = vybora_live_chat_messages.session_id
       and p.user_id = (select auth.uid())
  ));

drop policy if exists "Live participants send live chat" on public.vybora_live_chat_messages;
create policy "Live participants send live chat"
  on public.vybora_live_chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.vybora_live_participants p
       where p.session_id = vybora_live_chat_messages.session_id
         and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Live hosts or senders delete live chat" on public.vybora_live_chat_messages;
create policy "Live hosts or senders delete live chat"
  on public.vybora_live_chat_messages for delete to authenticated
  using (
    sender_id = (select auth.uid())
    or exists (
      select 1 from public.vybora_live_sessions s
       where s.id = vybora_live_chat_messages.session_id
         and s.host_id = (select auth.uid())
    )
  );

alter publication supabase_realtime add table public.vybora_live_chat_messages;
