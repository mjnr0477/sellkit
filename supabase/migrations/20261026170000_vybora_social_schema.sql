-- VYBORA social schema and access rules.
-- Safe to apply to the existing Mariona project; all objects are namespaced vybora_*.
begin;

create table if not exists public.vybora_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vybora_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) > 0 or media_url is not null)
);

create table if not exists public.vybora_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.vybora_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vybora_reactions (
  post_id uuid not null references public.vybora_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','laugh','wow','support')),
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table if not exists public.vybora_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id,followed_id),
  check (follower_id <> followed_id)
);

create table if not exists public.vybora_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.vybora_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,post_id)
);

create table if not exists public.vybora_post_stats (
  post_id uuid primary key references public.vybora_posts(id) on delete cascade,
  likes_count integer not null default 0 check (likes_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists vybora_posts_feed_idx on public.vybora_posts(created_at desc) where visibility='public';
create index if not exists vybora_posts_author_idx on public.vybora_posts(author_id,created_at desc);
create index if not exists vybora_comments_post_idx on public.vybora_comments(post_id,created_at);
create index if not exists vybora_comments_author_idx on public.vybora_comments(author_id,created_at desc);
create index if not exists vybora_reactions_user_idx on public.vybora_reactions(user_id,created_at desc);
create index if not exists vybora_follows_followed_idx on public.vybora_follows(followed_id,created_at desc);
create index if not exists vybora_bookmarks_post_idx on public.vybora_bookmarks(post_id);

alter table public.vybora_profiles enable row level security;
alter table public.vybora_posts enable row level security;
alter table public.vybora_comments enable row level security;
alter table public.vybora_reactions enable row level security;
alter table public.vybora_follows enable row level security;
alter table public.vybora_bookmarks enable row level security;
alter table public.vybora_post_stats enable row level security;

revoke all on public.vybora_profiles,public.vybora_posts,public.vybora_comments,
  public.vybora_reactions,public.vybora_follows,public.vybora_bookmarks,
  public.vybora_post_stats from anon,authenticated;
grant select on public.vybora_profiles,public.vybora_posts,public.vybora_comments to anon,authenticated;
grant insert,update,delete on public.vybora_profiles,public.vybora_posts,public.vybora_comments to authenticated;
grant select,insert,update,delete on public.vybora_reactions to authenticated;
grant select,insert,delete on public.vybora_follows,public.vybora_bookmarks to authenticated;
grant select on public.vybora_post_stats to anon,authenticated;

drop policy if exists "Vybora profiles are publicly readable" on public.vybora_profiles;
drop policy if exists "Users create their own Vybora profile" on public.vybora_profiles;
drop policy if exists "Users update their own Vybora profile" on public.vybora_profiles;
drop policy if exists "Users delete their own Vybora profile" on public.vybora_profiles;
create policy "Vybora profiles are publicly readable" on public.vybora_profiles for select to anon,authenticated using (true);
create policy "Users create their own Vybora profile" on public.vybora_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users update their own Vybora profile" on public.vybora_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users delete their own Vybora profile" on public.vybora_profiles for delete to authenticated using ((select auth.uid())=user_id);

drop policy if exists "Public can read public Vybora posts" on public.vybora_posts;
drop policy if exists "Users create their own Vybora posts" on public.vybora_posts;
drop policy if exists "Users update their own Vybora posts" on public.vybora_posts;
drop policy if exists "Users delete their own Vybora posts" on public.vybora_posts;
create policy "Public can read public Vybora posts" on public.vybora_posts for select to anon,authenticated using (visibility='public' or (select auth.uid())=author_id);
create policy "Users create their own Vybora posts" on public.vybora_posts for insert to authenticated with check ((select auth.uid())=author_id);
create policy "Users update their own Vybora posts" on public.vybora_posts for update to authenticated using ((select auth.uid())=author_id) with check ((select auth.uid())=author_id);
create policy "Users delete their own Vybora posts" on public.vybora_posts for delete to authenticated using ((select auth.uid())=author_id);

drop policy if exists "Comments on visible posts are readable" on public.vybora_comments;
drop policy if exists "Users comment as themselves on visible posts" on public.vybora_comments;
drop policy if exists "Users update their own Vybora comments" on public.vybora_comments;
drop policy if exists "Users delete their own Vybora comments" on public.vybora_comments;
create policy "Comments on visible posts are readable" on public.vybora_comments for select to anon,authenticated using (
  exists (select 1 from public.vybora_posts p where p.id=post_id and (p.visibility='public' or p.author_id=(select auth.uid())))
);
create policy "Users comment as themselves on visible posts" on public.vybora_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists (select 1 from public.vybora_posts p where p.id=post_id and p.visibility='public')
);
create policy "Users update their own Vybora comments" on public.vybora_comments for update to authenticated using ((select auth.uid())=author_id) with check ((select auth.uid())=author_id);
create policy "Users delete their own Vybora comments" on public.vybora_comments for delete to authenticated using ((select auth.uid())=author_id);

drop policy if exists "Authenticated users can read Vybora reactions" on public.vybora_reactions;
drop policy if exists "Users can read their own Vybora reactions" on public.vybora_reactions;
drop policy if exists "Users create their own Vybora reactions" on public.vybora_reactions;
drop policy if exists "Users react to public Vybora posts" on public.vybora_reactions;
drop policy if exists "Users update their own Vybora reactions" on public.vybora_reactions;
drop policy if exists "Users update reactions on public Vybora posts" on public.vybora_reactions;
drop policy if exists "Users delete their own Vybora reactions" on public.vybora_reactions;
create policy "Users can read their own Vybora reactions" on public.vybora_reactions for select to authenticated using ((select auth.uid())=user_id);
create policy "Users react to public Vybora posts" on public.vybora_reactions for insert to authenticated with check (
  (select auth.uid())=user_id and exists (select 1 from public.vybora_posts p where p.id=post_id and p.visibility='public')
);
create policy "Users update reactions on public Vybora posts" on public.vybora_reactions for update to authenticated using ((select auth.uid())=user_id) with check (
  (select auth.uid())=user_id and exists (select 1 from public.vybora_posts p where p.id=post_id and p.visibility='public')
);
create policy "Users delete their own Vybora reactions" on public.vybora_reactions for delete to authenticated using ((select auth.uid())=user_id);

drop policy if exists "Authenticated users can read Vybora follows" on public.vybora_follows;
drop policy if exists "Users read their own Vybora follow relationships" on public.vybora_follows;
drop policy if exists "Users create follows as themselves" on public.vybora_follows;
drop policy if exists "Users delete follows as themselves" on public.vybora_follows;
create policy "Users read their own Vybora follow relationships" on public.vybora_follows for select to authenticated using ((select auth.uid())=follower_id or (select auth.uid())=followed_id);
create policy "Users create follows as themselves" on public.vybora_follows for insert to authenticated with check ((select auth.uid())=follower_id);
create policy "Users delete follows as themselves" on public.vybora_follows for delete to authenticated using ((select auth.uid())=follower_id);

drop policy if exists "Users can access their own Vybora bookmarks" on public.vybora_bookmarks;
drop policy if exists "Users read their own Vybora bookmarks" on public.vybora_bookmarks;
drop policy if exists "Users bookmark public Vybora posts" on public.vybora_bookmarks;
drop policy if exists "Users delete their own Vybora bookmarks" on public.vybora_bookmarks;
create policy "Users read their own Vybora bookmarks" on public.vybora_bookmarks for select to authenticated using ((select auth.uid())=user_id);
create policy "Users bookmark public Vybora posts" on public.vybora_bookmarks for insert to authenticated with check (
  (select auth.uid())=user_id and exists (select 1 from public.vybora_posts p where p.id=post_id and p.visibility='public')
);
create policy "Users delete their own Vybora bookmarks" on public.vybora_bookmarks for delete to authenticated using ((select auth.uid())=user_id);

drop policy if exists "Vybora public post stats are readable" on public.vybora_post_stats;
create policy "Vybora public post stats are readable" on public.vybora_post_stats for select to anon,authenticated using (
  exists (select 1 from public.vybora_posts p where p.id=post_id and p.visibility='public')
);

create or replace function public.vybora_update_post_stats()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' then
    insert into public.vybora_post_stats(post_id,likes_count,updated_at)
    values(new.post_id,1,now())
    on conflict(post_id) do update set likes_count=public.vybora_post_stats.likes_count+1,updated_at=now();
    return new;
  elsif tg_op='DELETE' then
    update public.vybora_post_stats set likes_count=greatest(likes_count-1,0),updated_at=now() where post_id=old.post_id;
    return old;
  end if;
  return null;
end;
$function$;
revoke all on function public.vybora_update_post_stats() from public,anon,authenticated;
drop trigger if exists vybora_reactions_stats_insert on public.vybora_reactions;
drop trigger if exists vybora_reactions_stats_delete on public.vybora_reactions;
create trigger vybora_reactions_stats_insert after insert on public.vybora_reactions for each row execute function public.vybora_update_post_stats();
create trigger vybora_reactions_stats_delete after delete on public.vybora_reactions for each row execute function public.vybora_update_post_stats();

insert into public.vybora_post_stats(post_id,likes_count)
select post_id,count(*)::integer from public.vybora_reactions group by post_id
on conflict(post_id) do update set likes_count=excluded.likes_count,updated_at=now();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vybora-media','vybora-media',true,104857600,array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Vybora media public read" on storage.objects;
drop policy if exists "Vybora users upload own media" on storage.objects;
drop policy if exists "Vybora users update own media" on storage.objects;
drop policy if exists "Vybora users delete own media" on storage.objects;
create policy "Vybora media public read" on storage.objects for select to anon,authenticated using (bucket_id='vybora-media');
create policy "Vybora users upload own media" on storage.objects for insert to authenticated with check (bucket_id='vybora-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Vybora users update own media" on storage.objects for update to authenticated using (bucket_id='vybora-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='vybora-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Vybora users delete own media" on storage.objects for delete to authenticated using (bucket_id='vybora-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
