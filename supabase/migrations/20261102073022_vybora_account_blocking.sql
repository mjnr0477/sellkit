-- VYBORA account blocking: enforce reciprocal blocks at the database boundary.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.vybora_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint vybora_blocks_no_self check (blocker_id <> blocked_user_id)
);
create index if not exists vybora_blocks_target_idx on public.vybora_blocks(blocked_user_id, blocker_id);
alter table public.vybora_blocks enable row level security;
revoke all on public.vybora_blocks from anon, authenticated;
grant select, insert, delete on public.vybora_blocks to authenticated;
create policy "Users read their own VYBORA blocks"
  on public.vybora_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy "Users create their own VYBORA blocks"
  on public.vybora_blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_user_id);
create policy "Users remove their own VYBORA blocks"
  on public.vybora_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

create or replace function private.vybora_is_blocked(target_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select coalesce(
    (select auth.uid()) is not null
    and target_user_id is not null
    and target_user_id <> (select auth.uid())
    and exists (
      select 1 from public.vybora_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_user_id = target_user_id)
         or (b.blocker_id = target_user_id and b.blocked_user_id = (select auth.uid()))
    ), false
  );
$function$;
revoke all on function private.vybora_is_blocked(uuid) from public, anon;
grant execute on function private.vybora_is_blocked(uuid) to authenticated;

drop policy if exists "Vybora profiles are publicly readable" on public.vybora_profiles;
create policy "VYBORA profiles are public to guests" on public.vybora_profiles for select to anon using (true);
create policy "VYBORA profiles hide blocked accounts" on public.vybora_profiles for select to authenticated
  using (user_id = (select auth.uid()) or not private.vybora_is_blocked(user_id));

drop policy if exists "Public can read public Vybora posts" on public.vybora_posts;
create policy "Guests can read public VYBORA posts" on public.vybora_posts for select to anon
  using (visibility = 'public' and (expires_at is null or expires_at > now()));
create policy "Members cannot read blocked VYBORA posts" on public.vybora_posts for select to authenticated
  using (((visibility = 'public' and (expires_at is null or expires_at > now())) or author_id = (select auth.uid()))
    and (author_id = (select auth.uid()) or not private.vybora_is_blocked(author_id)));

drop policy if exists "Comments on visible posts are readable" on public.vybora_comments;
create policy "Guests can read comments on public VYBORA posts" on public.vybora_comments for select to anon
  using (exists (select 1 from public.vybora_posts p where p.id = post_id and p.visibility = 'public'
    and (p.expires_at is null or p.expires_at > now())));
create policy "Members can read comments without blocked accounts" on public.vybora_comments for select to authenticated
  using (not private.vybora_is_blocked(author_id) and exists (
    select 1 from public.vybora_posts p where p.id = post_id
      and (p.visibility = 'public' or p.author_id = (select auth.uid()))
      and (p.author_id = (select auth.uid()) or not private.vybora_is_blocked(p.author_id))
  ));
drop policy if exists "Users comment as themselves on visible posts" on public.vybora_comments;
create policy "Members comment on posts without blocking" on public.vybora_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.vybora_posts p where p.id = post_id and p.visibility = 'public'
      and (p.author_id = (select auth.uid()) or not private.vybora_is_blocked(p.author_id))
  ));

drop policy if exists "Users create follows as themselves" on public.vybora_follows;
create policy "Users follow accounts they have not blocked" on public.vybora_follows for insert to authenticated
  with check ((select auth.uid()) = follower_id and not private.vybora_is_blocked(followed_id));
drop policy if exists "Users read their own Vybora follow relationships" on public.vybora_follows;
create policy "Users read unblocked VYBORA follow relationships" on public.vybora_follows for select to authenticated
  using (((select auth.uid()) = follower_id or (select auth.uid()) = followed_id)
    and not private.vybora_is_blocked(case when (select auth.uid()) = follower_id then followed_id else follower_id end));

drop policy if exists "Vybora users see their friend requests" on public.vybora_friend_requests;
create policy "VYBORA users see requests without blocks" on public.vybora_friend_requests for select to authenticated
  using (((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id)
    and not private.vybora_is_blocked(case when (select auth.uid()) = sender_id then recipient_id else sender_id end));
drop policy if exists "Vybora users send friend requests" on public.vybora_friend_requests;
create policy "VYBORA users request friendship without blocks" on public.vybora_friend_requests for insert to authenticated
  with check ((select auth.uid()) = sender_id and status = 'pending'
    and not private.vybora_is_blocked(recipient_id)
    and not exists (select 1 from public.vybora_friend_requests f
      where f.sender_id = vybora_friend_requests.recipient_id and f.recipient_id = vybora_friend_requests.sender_id
        and f.status = 'accepted'));
drop policy if exists "Vybora recipients respond to friend requests" on public.vybora_friend_requests;
create policy "VYBORA recipients respond to unblocked requests" on public.vybora_friend_requests for update to authenticated
  using ((select auth.uid()) = recipient_id and status = 'pending' and not private.vybora_is_blocked(sender_id))
  with check ((select auth.uid()) = recipient_id and status in ('accepted','declined') and not private.vybora_is_blocked(sender_id));

drop policy if exists "Vybora friends read messages" on public.vybora_messages;
create policy "VYBORA friends read messages without blocks" on public.vybora_messages for select to authenticated
  using (((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id)
    and not private.vybora_is_blocked(case when (select auth.uid()) = sender_id then recipient_id else sender_id end)
    and exists (select 1 from public.vybora_friend_requests f where f.status = 'accepted'
      and ((f.sender_id = vybora_messages.sender_id and f.recipient_id = vybora_messages.recipient_id)
        or (f.sender_id = vybora_messages.recipient_id and f.recipient_id = vybora_messages.sender_id))));
drop policy if exists "Vybora friends send messages" on public.vybora_messages;
create policy "VYBORA friends send messages without blocks" on public.vybora_messages for insert to authenticated
  with check ((select auth.uid()) = sender_id and not private.vybora_is_blocked(recipient_id)
    and exists (select 1 from public.vybora_friend_requests f where f.status = 'accepted'
      and ((f.sender_id = vybora_messages.sender_id and f.recipient_id = vybora_messages.recipient_id)
        or (f.sender_id = vybora_messages.recipient_id and f.recipient_id = vybora_messages.sender_id))));
drop policy if exists "Vybora recipients mark messages read" on public.vybora_messages;
create policy "VYBORA recipients mark unblocked messages read" on public.vybora_messages for update to authenticated
  using ((select auth.uid()) = recipient_id and not private.vybora_is_blocked(sender_id))
  with check ((select auth.uid()) = recipient_id and not private.vybora_is_blocked(sender_id));

drop policy if exists "Vybora active live sessions are public" on public.vybora_live_sessions;
create policy "Guests can discover active VYBORA live sessions" on public.vybora_live_sessions for select to anon using (status = 'live');
create policy "Members cannot discover blocked VYBORA live hosts" on public.vybora_live_sessions for select to authenticated
  using ((status = 'live' or host_id = (select auth.uid()))
    and (host_id = (select auth.uid()) or not private.vybora_is_blocked(host_id)));

drop policy if exists "Vybora users join live sessions" on public.vybora_live_participants;
create policy "Members join live sessions without blocks" on public.vybora_live_participants for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.vybora_live_sessions s where s.id = session_id and s.status = 'live'
      and (s.host_id = (select auth.uid()) or not private.vybora_is_blocked(s.host_id))
  ));

drop policy if exists "Vybora live participants read their signals" on public.vybora_live_signals;
create policy "Members read unblocked live signals" on public.vybora_live_signals for select to authenticated
  using ((recipient_id = (select auth.uid()) or sender_id = (select auth.uid()))
    and not private.vybora_is_blocked(case when sender_id = (select auth.uid()) then recipient_id else sender_id end));
drop policy if exists "Vybora live participants send signals" on public.vybora_live_signals;
create policy "Members send live signals without blocks" on public.vybora_live_signals for insert to authenticated
  with check (sender_id = (select auth.uid()) and not private.vybora_is_blocked(recipient_id)
    and exists (select 1 from public.vybora_live_participants p where p.session_id = vybora_live_signals.session_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.vybora_live_participants p where p.session_id = vybora_live_signals.session_id and p.user_id = vybora_live_signals.recipient_id));
commit;
