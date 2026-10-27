-- VYBORA-only database hardening based on Supabase advisor findings.
-- The cleanup state is internal and must never be accessible from client roles.
begin;

drop policy if exists "VYBORA internal cleanup state is never client accessible" on public.vybora_cleanup_state;
create policy "VYBORA internal cleanup state is never client accessible"
  on public.vybora_cleanup_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Supports per-user view-history cleanup and lookup without a sequential scan.
create index if not exists vybora_video_views_viewer_created_idx
  on public.vybora_video_views (viewer_id, created_at desc);

commit;
