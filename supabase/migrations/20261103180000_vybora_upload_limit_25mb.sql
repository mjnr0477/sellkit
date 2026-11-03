-- Raise the per-video ceiling while retaining the existing daily and total storage guards.
begin;
update storage.buckets
set file_size_limit = 26214400
where id = 'vybora-media';
commit;
