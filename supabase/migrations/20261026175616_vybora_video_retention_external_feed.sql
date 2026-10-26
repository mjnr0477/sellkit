-- Backfill expiry/storage paths and install scheduled cleanup infrastructure.
begin;
alter table public.vybora_posts add column if not exists views_count bigint not null default 0;
alter table public.vybora_external_videos add column if not exists views_count bigint not null default 0;
update public.vybora_posts
set media_path=regexp_replace(media_url,'^.*/storage/v1/object/public/vybora-media/',''),
    expires_at=coalesce(expires_at,created_at+interval '24 hours')
where media_type='video' and media_url like '%/storage/v1/object/public/vybora-media/%';
drop policy if exists "Public can read public Vybora posts" on public.vybora_posts;
create policy "Public can read public Vybora posts" on public.vybora_posts for select to anon,authenticated
using((visibility='public' and (expires_at is null or expires_at>now())) or (select auth.uid())=author_id);
drop policy if exists "VYBORA public posts visible until expiry" on public.vybora_posts;
create table if not exists public.vybora_cleanup_state(singleton boolean primary key default true check(singleton),last_run_at timestamptz not null default '-infinity');
insert into public.vybora_cleanup_state(singleton,last_run_at) values(true,'-infinity') on conflict(singleton) do nothing;
alter table public.vybora_cleanup_state enable row level security;
revoke all on public.vybora_cleanup_state from anon,authenticated;
create or replace function public.vybora_claim_cleanup_run()
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed boolean := false;
begin
 update public.vybora_cleanup_state set last_run_at=now() where singleton=true and last_run_at<now()-interval '5 minutes';
 get diagnostics claimed=row_count;
 return claimed;
end; $$;
revoke all on function public.vybora_claim_cleanup_run() from public,anon,authenticated;
grant execute on function public.vybora_claim_cleanup_run() to service_role;
create or replace function public.vybora_record_video_view(p_post_id uuid default null,p_external_video_id uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer; inserted_id uuid;
begin
 if (p_post_id is not null)::int+(p_external_video_id is not null)::int<>1 then raise exception 'Supply exactly one video identifier'; end if;
 insert into public.vybora_video_views(post_id,external_video_id,viewer_id,view_date)
 values(p_post_id,p_external_video_id,(select auth.uid()),(timezone('utc',now()))::date)
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
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('vybora-expired-video-cleanup','*/10 * * * *',
 $$select net.http_post(url:='https://lzmrvalonsxtapigtjcx.supabase.co/functions/v1/vybora-cleanup-expired-videos',
 headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_hxYPL9XPZlzwbtgAxpNC3Q_KtrMUY31'),
 body:='{}'::jsonb,timeout_milliseconds:=10000) as request_id;$$);
commit;