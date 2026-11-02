-- VYBORA staff-only report queue and private moderation audit.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.vybora_is_staff()
returns boolean language sql stable security invoker set search_path = ''
as $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'vybora_role') in ('moderator','admin'), false);
$function$;
revoke all on function private.vybora_is_staff() from public, anon;
grant execute on function private.vybora_is_staff() to authenticated;

alter table public.vybora_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;
create index if not exists vybora_reports_reviewed_idx
  on public.vybora_reports(status, reviewed_at desc nulls last, created_at desc);

create table if not exists private.vybora_report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.vybora_reports(id) on delete cascade,
  moderator_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('open','reviewing','resolved','dismissed')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists vybora_report_reviews_report_idx
  on private.vybora_report_reviews(report_id, created_at desc);
alter table private.vybora_report_reviews enable row level security;
revoke all on private.vybora_report_reviews from public, anon, authenticated;
grant select, insert on private.vybora_report_reviews to authenticated;
create policy "VYBORA staff read report review history"
  on private.vybora_report_reviews for select to authenticated
  using (private.vybora_is_staff());
create policy "VYBORA staff add report review history"
  on private.vybora_report_reviews for insert to authenticated
  with check (private.vybora_is_staff() and moderator_id = (select auth.uid()));

create policy "VYBORA staff can review reports"
  on public.vybora_reports for select to authenticated
  using (private.vybora_is_staff());
create policy "VYBORA staff update report status"
  on public.vybora_reports for update to authenticated
  using (private.vybora_is_staff())
  with check (private.vybora_is_staff() and reviewed_by = (select auth.uid()) and reviewed_at is not null);
grant update(status, reviewed_by, reviewed_at) on public.vybora_reports to authenticated;

create or replace function public.vybora_review_report(p_report_id uuid,p_status text,p_notes text default '')
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if not private.vybora_is_staff() then
    raise exception using errcode = '42501', message = 'VYBORA moderator access required';
  end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then
    raise exception using errcode = '22023', message = 'Invalid report status';
  end if;
  if char_length(coalesce(p_notes,'')) > 2000 then
    raise exception using errcode = '22023', message = 'Moderator notes are too long';
  end if;
  update public.vybora_reports set status=p_status,reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_report_id;
  if not found then raise exception using errcode = 'P0002', message = 'Report not found or not accessible'; end if;
  insert into private.vybora_report_reviews(report_id,moderator_id,action,notes)
    values(p_report_id,(select auth.uid()),p_status,left(coalesce(p_notes,''),2000));
end;
$function$;
revoke all on function public.vybora_review_report(uuid,text,text) from public, anon;
grant execute on function public.vybora_review_report(uuid,text,text) to authenticated;
commit;
