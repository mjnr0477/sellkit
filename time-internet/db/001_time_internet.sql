-- Run in the NEW Supabase project dedicated to this experiment.
-- Do not paste the service-role key into a browser or Android app.
-- RLS is enabled; server-side service-role credentials are required.

create table if not exists public.time_internet_payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  package_id text not null,
  amount_kes integer not null check (amount_kes > 0),
  reference text not null unique,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  checkout_request_id text unique,
  receipt_number text unique,
  paid_at_ms bigint,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists time_internet_payments_user_created_idx
  on public.time_internet_payments (user_id, created_at desc);

create table if not exists public.time_internet_entitlements (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.time_internet_payments(id),
  user_id text not null,
  package_id text not null,
  starts_at_ms bigint not null,
  expires_at_ms bigint not null check (expires_at_ms > starts_at_ms),
  created_at timestamptz not null default now()
);

create index if not exists time_internet_entitlements_user_expiry_idx
  on public.time_internet_entitlements (user_id, expires_at_ms desc);

alter table public.time_internet_payments enable row level security;
alter table public.time_internet_entitlements enable row level security;

-- Intentionally create no client policies. Only a trusted server using the
-- service-role key should read/write these financial and access-control rows.
