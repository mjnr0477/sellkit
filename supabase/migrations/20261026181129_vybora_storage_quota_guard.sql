-- Hard cap VYBORA uploads to protect the shared free Supabase Storage quota.
begin;
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated,service_role;
create or replace function private.vybora_can_upload_media()
returns boolean language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null
 and (select coalesce(sum(case when (o.metadata->>'size') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end),0)
      from storage.objects o where o.bucket_id='vybora-media') < 700*1024*1024
 and (select count(*) from storage.objects o
      where o.bucket_id='vybora-media'
        and (storage.foldername(o.name))[1]=(select auth.uid())::text
        and o.created_at>now()-interval '24 hours') < 3;
$$;
revoke all on function private.vybora_can_upload_media() from public,anon;
grant execute on function private.vybora_can_upload_media() to authenticated,service_role;
update storage.buckets set file_size_limit=10485760 where id='vybora-media';
drop policy if exists "Vybora users upload own media" on storage.objects;
create policy "Vybora users upload own media" on storage.objects for insert to authenticated
with check(bucket_id='vybora-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and private.vybora_can_upload_media());
commit;