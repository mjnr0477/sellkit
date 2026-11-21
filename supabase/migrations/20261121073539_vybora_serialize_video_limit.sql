-- Prevent concurrent publishes by the same author from bypassing the three-video rolling 24-hour limit.
-- The transaction-scoped advisory lock serializes the count-and-insert check per author.
create or replace function public.vybora_enforce_video_limits()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  recent_count integer;
begin
  if new.media_type in ('video','external') and new.media_url is not null then
    if new.author_id is distinct from (select auth.uid()) and current_user not in ('postgres','service_role') then
      raise exception 'You may only publish videos to your own account';
    end if;

    if new.media_type = 'video' and (new.media_path is null or char_length(new.media_path) < 3) then
      raise exception 'Uploaded videos must include their storage path so automatic deletion can work';
    end if;

    if new.media_type = 'external' then
      if new.source_url is null or new.source_name is null then
        raise exception 'External videos must include their original source URL';
      end if;
      if lower(split_part(regexp_replace(new.source_url, '^https?://', ''), '/', 1)) not in
        ('youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be',
         'tiktok.com','www.tiktok.com','vm.tiktok.com','instagram.com','www.instagram.com',
         'vimeo.com','www.vimeo.com','player.vimeo.com','interactive-examples.mdn.mozilla.net',
         'www.w3schools.com')
      then
        raise exception 'Video source is not supported';
      end if;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.author_id::text, 0)
    );

    select count(*)::integer
      into recent_count
      from public.vybora_posts p
     where p.author_id = new.author_id
       and p.media_type in ('video','external')
       and p.media_url is not null
       and p.created_at > now() - interval '24 hours';

    if recent_count >= 3 then
      raise exception 'Daily video limit reached: maximum three videos in any 24-hour period';
    end if;

    new.created_at := now();
    new.expires_at := now() + interval '24 hours';
  end if;

  return new;
end;
$function$;

revoke all on function public.vybora_enforce_video_limits() from public, anon, authenticated;
