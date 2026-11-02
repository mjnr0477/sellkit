-- Private, per-account creator mute preferences. Mutes only affect the viewer's feed.
begin;
create table if not exists public.vybora_mutes (
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  constraint vybora_mutes_no_self check (user_id <> muted_user_id)
);
create index if not exists vybora_mutes_target_idx on public.vybora_mutes(muted_user_id, user_id);
alter table public.vybora_mutes enable row level security;
revoke all on public.vybora_mutes from anon, authenticated;
grant select, insert, delete on public.vybora_mutes to authenticated;
drop policy if exists "Users read their own VYBORA mutes" on public.vybora_mutes;
drop policy if exists "Users create their own VYBORA mutes" on public.vybora_mutes;
drop policy if exists "Users remove their own VYBORA mutes" on public.vybora_mutes;
create policy "Users read their own VYBORA mutes"
  on public.vybora_mutes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own VYBORA mutes"
  on public.vybora_mutes for insert to authenticated
  with check ((select auth.uid()) = user_id and user_id <> muted_user_id);
create policy "Users remove their own VYBORA mutes"
  on public.vybora_mutes for delete to authenticated
  using ((select auth.uid()) = user_id);
commit;
