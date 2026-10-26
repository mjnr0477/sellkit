-- Harden expiry enforcement and make authenticated view counters safe for public posts.
begin;
create or replace function public.vybora_enforce_video_limits()
returns trigger language plpgsql set search_path = '' as $$
declare recent_count integer;
begin
 if new.media_type='video' and new.media_url is not null then
   if new.media_path is null or char_length(new.media_path)<3 then
     raise exception 'Uploaded videos must include their storage path so automatic deletion can work';
   end if;
   if new.author_id is distinct from (select auth.uid()) and current_user not in ('postgres','service_role') then
     raise exception 'You may only publish videos to your own account';
   end if;
   select count(*)::integer into recent_count from public.vybora_posts p
    where p.author_id=new.author_id and p.media_type='video' and p.media_path is not null
      and p.created_at>now()-interval '24 hours';
   if recent_count>=3 then raise exception 'Daily video limit reached: maximum three uploaded videos in any 24-hour period'; end if;
   new.created_at:=now();
   new.expires_at:=now()+interval '24 hours';
 end if;
 return new;
end; $$;
revoke all on function public.vybora_enforce_video_limits() from public,anon,authenticated;
create or replace function public.vybora_record_video_view(p_post_id uuid default null,p_external_video_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; inserted_id uuid; viewer uuid := (select auth.uid());
begin
 if viewer is null then raise exception 'Sign in is required to record a view'; end if;
 if (p_post_id is not null)::int+(p_external_video_id is not null)::int<>1 then raise exception 'Supply exactly one video identifier'; end if;
 if p_post_id is not null and not exists(select 1 from public.vybora_posts where id=p_post_id and visibility='public' and (expires_at is null or expires_at>now())) then raise exception 'Video is unavailable'; end if;
 if p_external_video_id is not null and not exists(select 1 from public.vybora_external_videos where id=p_external_video_id and active=true) then raise exception 'Video is unavailable'; end if;
 insert into public.vybora_video_views(post_id,external_video_id,viewer_id,view_date)
 values(p_post_id,p_external_video_id,viewer,(timezone('utc',now()))::date)
 on conflict do nothing returning id into inserted_id;
 if inserted_id is not null then
   if p_post_id is not null then update public.vybora_posts set views_count=views_count+1 where id=p_post_id;
   else update public.vybora_external_videos set views_count=views_count+1 where id=p_external_video_id and active=true; end if;
 end if;
 if p_post_id is not null then select views_count::integer into n from public.vybora_posts where id=p_post_id;
 else select views_count::integer into n from public.vybora_external_videos where id=p_external_video_id; end if;
 return coalesce(n,0);
end; $$;
revoke all on function public.vybora_record_video_view(uuid,uuid) from public,anon;
grant execute on function public.vybora_record_video_view(uuid,uuid) to authenticated;
commit;