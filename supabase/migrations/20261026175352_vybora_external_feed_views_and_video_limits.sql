-- VYBORA external video discovery, view tracking and 24-hour upload expiry.
begin;
alter table public.vybora_posts add column if not exists expires_at timestamptz;
alter table public.vybora_posts add column if not exists media_path text;
create table if not exists public.vybora_external_videos (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 160),
 creator text not null, source_name text not null, source_url text not null, embed_url text not null,
 description text not null default '', mature_content boolean not null default false,
 active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.vybora_external_videos enable row level security;
revoke all on public.vybora_external_videos from anon, authenticated;
grant select on public.vybora_external_videos to anon, authenticated;
drop policy if exists "VYBORA curated external videos are public" on public.vybora_external_videos;
create policy "VYBORA curated external videos are public" on public.vybora_external_videos for select to anon, authenticated using (active = true);
create table if not exists public.vybora_video_views (
 id uuid primary key default gen_random_uuid(),
 post_id uuid references public.vybora_posts(id) on delete cascade,
 external_video_id uuid references public.vybora_external_videos(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 view_date date not null default (timezone('utc', now()))::date,
 created_at timestamptz not null default now(),
 check ((post_id is not null)::int + (external_video_id is not null)::int = 1)
);
create unique index if not exists vybora_post_view_once_daily on public.vybora_video_views(post_id,viewer_id,view_date) where post_id is not null;
create unique index if not exists vybora_external_view_once_daily on public.vybora_video_views(external_video_id,viewer_id,view_date) where external_video_id is not null;
create index if not exists vybora_video_views_post_idx on public.vybora_video_views(post_id,created_at desc) where post_id is not null;
create index if not exists vybora_video_views_external_idx on public.vybora_video_views(external_video_id,created_at desc) where external_video_id is not null;
alter table public.vybora_video_views enable row level security;
revoke all on public.vybora_video_views from anon, authenticated;
grant select, insert on public.vybora_video_views to authenticated;
drop policy if exists "VYBORA users read view counts" on public.vybora_video_views;
create policy "VYBORA users read view counts" on public.vybora_video_views for select to authenticated using (true);
drop policy if exists "VYBORA users record their own views" on public.vybora_video_views;
create policy "VYBORA users record their own views" on public.vybora_video_views for insert to authenticated with check (viewer_id = (select auth.uid()));
create or replace function public.vybora_enforce_video_limits()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.media_type = 'video' and new.media_path is not null then
   if new.author_id is distinct from (select auth.uid()) and current_user not in ('postgres','service_role') then raise exception 'You may only publish videos to your own account'; end if;
   if (select count(*) from public.vybora_posts p where p.author_id=new.author_id and p.media_type='video' and p.media_path is not null and p.created_at > now()-interval '24 hours') >= 3 then
     raise exception 'Daily video limit reached: maximum three uploaded videos in any 24-hour period';
   end if;
   new.expires_at := coalesce(new.expires_at, now()+interval '24 hours');
 end if;
 return new;
end; $$;
drop trigger if exists vybora_enforce_video_limits_trigger on public.vybora_posts;
create trigger vybora_enforce_video_limits_trigger before insert on public.vybora_posts for each row execute function public.vybora_enforce_video_limits();
revoke all on function public.vybora_enforce_video_limits() from public,anon,authenticated;
create or replace function public.vybora_record_video_view(p_post_id uuid default null,p_external_video_id uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 if (p_post_id is not null)::int + (p_external_video_id is not null)::int <> 1 then raise exception 'Supply exactly one video identifier'; end if;
 insert into public.vybora_video_views(post_id,external_video_id,viewer_id,view_date)
 values(p_post_id,p_external_video_id,(select auth.uid()),(timezone('utc',now()))::date) on conflict do nothing;
 if p_post_id is not null then select count(*)::integer into n from public.vybora_video_views where post_id=p_post_id;
 else select count(*)::integer into n from public.vybora_video_views where external_video_id=p_external_video_id; end if;
 return coalesce(n,0);
end; $$;
revoke all on function public.vybora_record_video_view(uuid,uuid) from public,anon;
grant execute on function public.vybora_record_video_view(uuid,uuid) to authenticated;
insert into public.vybora_external_videos(title,creator,source_name,source_url,embed_url,description)
select 'Big Buck Bunny','Blender Open Movies','YouTube','https://www.youtube.com/watch?v=aqz-KE-bpKQ','https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ','A short animated film hosted by its original publisher.'
where not exists(select 1 from public.vybora_external_videos where source_url='https://www.youtube.com/watch?v=aqz-KE-bpKQ');
insert into public.vybora_external_videos(title,creator,source_name,source_url,embed_url,description)
select 'Flower Study','MDN Web Docs','MDN sample media','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4','A remotely hosted sample video; playback is streamed from the original host.'
where not exists(select 1 from public.vybora_external_videos where source_url='https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
drop policy if exists "VYBORA public posts visible until expiry" on public.vybora_posts;
create policy "VYBORA public posts visible until expiry" on public.vybora_posts for select to anon,authenticated using(visibility='public' and (expires_at is null or expires_at>now()));
commit;