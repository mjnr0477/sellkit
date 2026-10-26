-- VYBORA social connections, messaging, live signaling and safety controls.
begin;
alter table public.vybora_profiles add column if not exists allow_mature_content boolean not null default false;
alter table public.vybora_posts add column if not exists mature_content boolean not null default false;

create table if not exists public.vybora_friend_requests(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in('pending','accepted','declined')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(sender_id<>recipient_id), unique(sender_id,recipient_id)
);
create index if not exists vybora_friend_requests_recipient_idx on public.vybora_friend_requests(recipient_id,status,created_at desc);
create table if not exists public.vybora_messages(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 4000),
 created_at timestamptz not null default now(), read_at timestamptz,
 check(sender_id<>recipient_id)
);
create index if not exists vybora_messages_thread_idx on public.vybora_messages(sender_id,recipient_id,created_at desc);
create table if not exists public.vybora_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references public.vybora_posts(id) on delete cascade,
 reported_user_id uuid references auth.users(id) on delete cascade,
 reason text not null check(reason in('mature_content','harassment','spam','violence','hate','sexual_content','other')),
 details text not null default '' check(char_length(details)<=1000),
 status text not null default 'open' check(status in('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 check(post_id is not null or reported_user_id is not null)
);
create index if not exists vybora_reports_open_idx on public.vybora_reports(status,created_at desc);
create table if not exists public.vybora_live_sessions(
 id uuid primary key default gen_random_uuid(),
 host_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Live on VYBORA' check(char_length(title) between 1 and 120),
 status text not null default 'live' check(status in('live','ended')),
 mature_content boolean not null default false,
 created_at timestamptz not null default now(), ended_at timestamptz
);
create index if not exists vybora_live_sessions_active_idx on public.vybora_live_sessions(status,created_at desc);
create table if not exists public.vybora_live_participants(
 session_id uuid not null references public.vybora_live_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(session_id,user_id)
);
create table if not exists public.vybora_live_signals(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.vybora_live_sessions(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 signal_type text not null check(signal_type in('offer','answer','ice','leave')),
 payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 check(sender_id<>recipient_id)
);
create index if not exists vybora_live_signals_recipient_idx on public.vybora_live_signals(session_id,recipient_id,created_at);
alter table public.vybora_friend_requests enable row level security;
alter table public.vybora_messages enable row level security;
alter table public.vybora_reports enable row level security;
alter table public.vybora_live_sessions enable row level security;
alter table public.vybora_live_participants enable row level security;
alter table public.vybora_live_signals enable row level security;
revoke all on public.vybora_friend_requests,public.vybora_messages,public.vybora_reports,public.vybora_live_sessions,public.vybora_live_participants,public.vybora_live_signals from anon,authenticated;
grant select,insert,update,delete on public.vybora_friend_requests to authenticated;
grant select,insert on public.vybora_messages to authenticated;
grant select,insert on public.vybora_reports to authenticated;
grant select,insert,update on public.vybora_live_sessions to authenticated;
grant select,insert,delete on public.vybora_live_participants to authenticated;
grant select,insert on public.vybora_live_signals to authenticated;
grant select on public.vybora_live_sessions to anon;
drop policy if exists "Vybora users see their friend requests" on public.vybora_friend_requests;
create policy "Vybora users see their friend requests" on public.vybora_friend_requests for select to authenticated using((select auth.uid())=sender_id or (select auth.uid())=recipient_id);
drop policy if exists "Vybora users send friend requests" on public.vybora_friend_requests;
create policy "Vybora users send friend requests" on public.vybora_friend_requests for insert to authenticated with check((select auth.uid())=sender_id and status='pending' and not exists(select 1 from public.vybora_friend_requests f where f.sender_id=vybora_friend_requests.recipient_id and f.recipient_id=vybora_friend_requests.sender_id and f.status='accepted'));
drop policy if exists "Vybora recipients respond to friend requests" on public.vybora_friend_requests;
create policy "Vybora recipients respond to friend requests" on public.vybora_friend_requests for update to authenticated using((select auth.uid())=recipient_id and status='pending') with check((select auth.uid())=recipient_id and status in('accepted','declined'));
drop policy if exists "Vybora request owners cancel pending requests" on public.vybora_friend_requests;
create policy "Vybora request owners cancel pending requests" on public.vybora_friend_requests for delete to authenticated using((select auth.uid())=sender_id and status='pending');
create or replace function public.vybora_guard_friend_request() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.sender_id<>old.sender_id or new.recipient_id<>old.recipient_id or old.status<>'pending' or new.status not in('accepted','declined')) then
  raise exception 'Friend request identities are immutable and only pending requests can be answered';
 end if;
 return new;
end; $$;
drop trigger if exists vybora_guard_friend_request_trigger on public.vybora_friend_requests;
create trigger vybora_guard_friend_request_trigger before update on public.vybora_friend_requests for each row execute function public.vybora_guard_friend_request();
revoke all on function public.vybora_guard_friend_request() from public,anon,authenticated;
drop policy if exists "Vybora friends read messages" on public.vybora_messages;
create policy "Vybora friends read messages" on public.vybora_messages for select to authenticated using(((select auth.uid())=vybora_messages.sender_id or (select auth.uid())=vybora_messages.recipient_id) and exists(select 1 from public.vybora_friend_requests f where f.status='accepted' and ((f.sender_id=vybora_messages.sender_id and f.recipient_id=vybora_messages.recipient_id) or (f.sender_id=vybora_messages.recipient_id and f.recipient_id=vybora_messages.sender_id))));
drop policy if exists "Vybora friends send messages" on public.vybora_messages;
create policy "Vybora friends send messages" on public.vybora_messages for insert to authenticated with check((select auth.uid())=vybora_messages.sender_id and exists(select 1 from public.vybora_friend_requests f where f.status='accepted' and ((f.sender_id=vybora_messages.sender_id and f.recipient_id=vybora_messages.recipient_id) or (f.sender_id=vybora_messages.recipient_id and f.recipient_id=vybora_messages.sender_id))));
drop policy if exists "Vybora users submit reports" on public.vybora_reports;
create policy "Vybora users submit reports" on public.vybora_reports for insert to authenticated with check((select auth.uid())=reporter_id and (post_id is null or exists(select 1 from public.vybora_posts p where p.id=post_id and p.author_id<>(select auth.uid()))) and (reported_user_id is null or reported_user_id<>(select auth.uid())));
drop policy if exists "Vybora users read their own reports" on public.vybora_reports;
create policy "Vybora users read their own reports" on public.vybora_reports for select to authenticated using((select auth.uid())=reporter_id);
drop policy if exists "Vybora active live sessions are public" on public.vybora_live_sessions;
create policy "Vybora active live sessions are public" on public.vybora_live_sessions for select to anon,authenticated using(status='live' or host_id=(select auth.uid()));
drop policy if exists "Vybora members start their own live sessions" on public.vybora_live_sessions;
create policy "Vybora members start their own live sessions" on public.vybora_live_sessions for insert to authenticated with check((select auth.uid())=host_id);
drop policy if exists "Vybora hosts end their own live sessions" on public.vybora_live_sessions;
create policy "Vybora hosts end their own live sessions" on public.vybora_live_sessions for update to authenticated using((select auth.uid())=host_id) with check((select auth.uid())=host_id);
drop policy if exists "Vybora live participants see own row and host sees room" on public.vybora_live_participants;
create policy "Vybora live participants see own row and host sees room" on public.vybora_live_participants for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.vybora_live_sessions s where s.id=session_id and s.host_id=(select auth.uid())));
drop policy if exists "Vybora users join live sessions" on public.vybora_live_participants;
create policy "Vybora users join live sessions" on public.vybora_live_participants for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.vybora_live_sessions s where s.id=session_id and s.status='live'));
drop policy if exists "Vybora users leave live sessions" on public.vybora_live_participants;
create policy "Vybora users leave live sessions" on public.vybora_live_participants for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Vybora live participants read their signals" on public.vybora_live_signals;
create policy "Vybora live participants read their signals" on public.vybora_live_signals for select to authenticated using(recipient_id=(select auth.uid()) or sender_id=(select auth.uid()));
drop policy if exists "Vybora live participants send signals" on public.vybora_live_signals;
create policy "Vybora live participants send signals" on public.vybora_live_signals for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.vybora_live_participants p where p.session_id=vybora_live_signals.session_id and p.user_id=(select auth.uid())) and exists(select 1 from public.vybora_live_participants p where p.session_id=vybora_live_signals.session_id and p.user_id=vybora_live_signals.recipient_id));
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vybora_friend_requests') then alter publication supabase_realtime add table public.vybora_friend_requests; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vybora_messages') then alter publication supabase_realtime add table public.vybora_messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vybora_live_sessions') then alter publication supabase_realtime add table public.vybora_live_sessions; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vybora_live_participants') then alter publication supabase_realtime add table public.vybora_live_participants; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vybora_live_signals') then alter publication supabase_realtime add table public.vybora_live_signals; end if;
end $$;
commit;