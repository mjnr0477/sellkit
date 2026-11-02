-- Keep mature-content preferences private and reduce moderation-query overhead.
begin;

create table if not exists private.vybora_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_mature_content boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table private.vybora_user_settings enable row level security;
revoke all on private.vybora_user_settings from public, anon, authenticated;
grant select, insert, update on private.vybora_user_settings to authenticated;

drop policy if exists "Users read their own VYBORA settings" on private.vybora_user_settings;
drop policy if exists "Users create their own VYBORA settings" on private.vybora_user_settings;
drop policy if exists "Users update their own VYBORA settings" on private.vybora_user_settings;
create policy "Users read their own VYBORA settings"
  on private.vybora_user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own VYBORA settings"
  on private.vybora_user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own VYBORA settings"
  on private.vybora_user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Preserve existing preferences before the public profile column is retired.
insert into private.vybora_user_settings(user_id, show_mature_content)
select user_id, coalesce(allow_mature_content, false)
from public.vybora_profiles
on conflict (user_id) do update
set show_mature_content = excluded.show_mature_content,
    updated_at = now();

create or replace function public.vybora_get_mature_preference()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    (select s.show_mature_content
     from private.vybora_user_settings s
     where s.user_id = (select auth.uid())),
    false
  );
$function$;

create or replace function public.vybora_set_mature_preference(p_enabled boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  insert into private.vybora_user_settings(user_id, show_mature_content, updated_at)
  values ((select auth.uid()), coalesce(p_enabled, false), now())
  on conflict (user_id) do update
    set show_mature_content = excluded.show_mature_content,
        updated_at = now();
end;
$function$;

revoke all on function public.vybora_get_mature_preference() from public, anon;
revoke all on function public.vybora_set_mature_preference(boolean) from public, anon;
grant execute on function public.vybora_get_mature_preference() to authenticated;
grant execute on function public.vybora_set_mature_preference(boolean) to authenticated;

-- A single SELECT policy keeps staff queue access and reporter visibility
-- while avoiding duplicate permissive policy evaluation.
drop policy if exists "VYBORA staff can review reports" on public.vybora_reports;
drop policy if exists "Vybora users read their own reports" on public.vybora_reports;
create policy "VYBORA staff and reporters read reports"
  on public.vybora_reports for select to authenticated
  using (private.vybora_is_staff() or reporter_id = (select auth.uid()));

create index if not exists vybora_reports_reviewed_by_idx
  on public.vybora_reports(reviewed_by);
create index if not exists vybora_report_reviews_moderator_idx
  on private.vybora_report_reviews(moderator_id);

commit;
