-- Keep moderation audit private and perform report transitions through a checked private implementation.
begin;
revoke all on private.vybora_report_reviews from public, anon, authenticated;
create policy "VYBORA audit log is not directly accessible"
  on private.vybora_report_reviews for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "VYBORA staff read report review history" on private.vybora_report_reviews;
drop policy if exists "VYBORA staff add report review history" on private.vybora_report_reviews;
revoke update(status, reviewed_by, reviewed_at) on public.vybora_reports from authenticated;

create or replace function private.vybora_review_report_impl(p_report_id uuid,p_status text,p_notes text default '')
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.vybora_is_staff() then
    raise exception using errcode = '42501', message = 'VYBORA moderator access required';
  end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then
    raise exception using errcode = '22023', message = 'Invalid report status';
  end if;
  if char_length(coalesce(p_notes,'')) > 2000 then
    raise exception using errcode = '22023', message = 'Moderator notes are too long';
  end if;
  update public.vybora_reports set status=p_status,reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_report_id;
  if not found then raise exception using errcode = 'P0002', message = 'Report not found'; end if;
  insert into private.vybora_report_reviews(report_id,moderator_id,action,notes)
    values(p_report_id,(select auth.uid()),p_status,left(coalesce(p_notes,''),2000));
end;
$function$;
revoke all on function private.vybora_review_report_impl(uuid,text,text) from public, anon;
grant execute on function private.vybora_review_report_impl(uuid,text,text) to authenticated;

create or replace function public.vybora_review_report(p_report_id uuid,p_status text,p_notes text default '')
returns void language sql security invoker set search_path = ''
as $function$
  select private.vybora_review_report_impl(p_report_id,p_status,p_notes);
$function$;
revoke all on function public.vybora_review_report(uuid,text,text) from public, anon;
grant execute on function public.vybora_review_report(uuid,text,text) to authenticated;
commit;
