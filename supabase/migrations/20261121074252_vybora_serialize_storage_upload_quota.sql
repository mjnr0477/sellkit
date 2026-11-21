-- Serialize Storage metadata inserts so concurrent uploads cannot overrun the shared 400 MiB bucket cap.
-- The transaction lock also makes the per-account rolling upload-count check race-safe.
create or replace function private.vybora_can_upload_media()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  total_bytes bigint;
  recent_user_uploads integer;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vybora-media-upload-quota', 0)
  );

  select coalesce(sum(
    case
      when (o.metadata->>'size') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
      else 0
    end
  ), 0)::bigint
    into total_bytes
    from storage.objects o
   where o.bucket_id = 'vybora-media';

  select count(*)::integer
    into recent_user_uploads
    from storage.objects o
   where o.bucket_id = 'vybora-media'
     and (storage.foldername(o.name))[1] = (select auth.uid())::text
     and o.created_at > now() - interval '24 hours';

  return total_bytes < 400 * 1024 * 1024
     and recent_user_uploads < 3;
end;
$function$;
