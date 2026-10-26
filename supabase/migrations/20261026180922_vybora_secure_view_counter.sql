-- Count one authenticated view per user/video/day without exposing viewer identities.
begin;
grant insert on public.vybora_video_views to authenticated;
drop policy if exists "VYBORA users record their own views" on public.vybora_video_views;
create policy "VYBORA users record their own views" on public.vybora_video_views for insert to authenticated with check(viewer_id=(select auth.uid()));
create or replace function public.vybora_increment_video_view_counter()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.post_id is not null then update public.vybora_posts set views_count=views_count+1 where id=new.post_id;
 else update public.vybora_external_videos set views_count=views_count+1 where id=new.external_video_id and active=true; end if;
 return new;
end; $$;
revoke all on function public.vybora_increment_video_view_counter() from public,anon,authenticated;
drop trigger if exists vybora_increment_video_view_counter_trigger on public.vybora_video_views;
create trigger vybora_increment_video_view_counter_trigger after insert on public.vybora_video_views for each row execute function public.vybora_increment_video_view_counter();
create or replace function public.vybora_record_video_view(p_post_id uuid default null,p_external_video_id uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer; viewer uuid := (select auth.uid());
begin
 if viewer is null then raise exception 'Sign in is required to record a view'; end if;
 if (p_post_id is not null)::int+(p_external_video_id is not null)::int<>1 then raise exception 'Supply exactly one video identifier'; end if;
 if p_post_id is not null and not exists(select 1 from public.vybora_posts where id=p_post_id and visibility='public' and (expires_at is null or expires_at>now())) then raise exception 'Video is unavailable'; end if;
 if p_external_video_id is not null and not exists(select 1 from public.vybora_external_videos where id=p_external_video_id and active=true) then raise exception 'Video is unavailable'; end if;
 insert into public.vybora_video_views(post_id,external_video_id,viewer_id,view_date)
 values(p_post_id,p_external_video_id,viewer,(timezone('utc',now()))::date) on conflict do nothing;
 if p_post_id is not null then select views_count::integer into n from public.vybora_posts where id=p_post_id;
 else select views_count::integer into n from public.vybora_external_videos where id=p_external_video_id; end if;
 return coalesce(n,0);
end; $$;
revoke all on function public.vybora_record_video_view(uuid,uuid) from public,anon;
grant execute on function public.vybora_record_video_view(uuid,uuid) to authenticated;
commit;