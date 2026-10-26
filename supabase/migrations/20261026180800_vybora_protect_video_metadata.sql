-- Protect video expiry, ownership, source URLs and view counts from client edits.
begin;
revoke all on public.vybora_video_views from anon,authenticated;
drop policy if exists "VYBORA users read view counts" on public.vybora_video_views;
drop policy if exists "VYBORA users record their own views" on public.vybora_video_views;
create or replace function public.vybora_protect_video_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
 if (select auth.uid()) is not null and current_user not in ('postgres','service_role') and
   (new.author_id is distinct from old.author_id or new.media_url is distinct from old.media_url or
    new.media_path is distinct from old.media_path or new.media_type is distinct from old.media_type or
    new.source_url is distinct from old.source_url or new.source_name is distinct from old.source_name or
    new.created_at is distinct from old.created_at or new.expires_at is distinct from old.expires_at or
    new.views_count is distinct from old.views_count) then
   raise exception 'Video source, ownership, expiry and view counters are managed by VYBORA';
 end if;
 return new;
end; $$;
drop trigger if exists vybora_protect_video_metadata_trigger on public.vybora_posts;
create trigger vybora_protect_video_metadata_trigger before update on public.vybora_posts for each row execute function public.vybora_protect_video_metadata();
revoke all on function public.vybora_protect_video_metadata() from public,anon,authenticated;
commit;