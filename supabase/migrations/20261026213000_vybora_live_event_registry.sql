-- VYBORA official live-event registry.
-- Store event metadata and authorized provider links only; never copy or proxy video.
create table if not exists public.vybora_live_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 180),
  competition text,
  teams text,
  status text not null default 'upcoming' check (status in ('upcoming','live','ended','cancelled')),
  source_name text not null,
  official_url text not null check (official_url ~ '^https://'),
  embed_url text check (embed_url is null or embed_url ~ '^https://'),
  territory text[] not null default '{}',
  free_access boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  last_verified_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vybora_live_events_active_status_start_idx
  on public.vybora_live_events (active, status, starts_at);
alter table public.vybora_live_events enable row level security;
drop policy if exists "Public can read active live events" on public.vybora_live_events;
create policy "Public can read active live events"
  on public.vybora_live_events for select to anon, authenticated
  using (active = true);
-- Writes are intentionally unavailable to public clients; trusted server/service role manages verification.
grant select on public.vybora_live_events to anon, authenticated;
