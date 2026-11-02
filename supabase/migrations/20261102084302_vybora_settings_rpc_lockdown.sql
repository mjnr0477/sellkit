-- Keep the settings table out of the GraphQL surface; expose only owner-scoped RPCs.
begin;
revoke all on private.vybora_user_settings from public, anon, authenticated;

create or replace function public.vybora_get_mature_preference()
returns boolean
language sql
stable
security definer
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
security definer
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
commit;