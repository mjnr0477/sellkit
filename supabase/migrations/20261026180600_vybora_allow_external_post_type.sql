-- Allow externally hosted video embeds in VYBORA posts.
begin;
alter table public.vybora_posts drop constraint if exists vybora_posts_media_type_check;
alter table public.vybora_posts add constraint vybora_posts_media_type_check
 check(media_type is null or media_type in ('image','video','external'));
commit;