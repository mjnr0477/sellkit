-- Retire the mature-content preference from the publicly readable profile.
-- Values were copied into private.vybora_user_settings before this migration.
begin;
alter table public.vybora_profiles drop column if exists allow_mature_content;
commit;
