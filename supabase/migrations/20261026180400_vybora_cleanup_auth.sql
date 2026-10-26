-- Protect the public-edge cleanup endpoint with a random Vault token.
begin;
select vault.create_secret(encode(gen_random_bytes(32),'hex'),'vybora_cleanup_token','Private token for scheduled VYBORA expired-video cleanup')
where not exists(select 1 from vault.secrets where name='vybora_cleanup_token');
create or replace function public.vybora_validate_cleanup_token(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare expected text;
begin
 select decrypted_secret into expected from vault.decrypted_secrets where name='vybora_cleanup_token';
 return expected is not null and p_token is not null and p_token=expected;
end; $$;
revoke all on function public.vybora_validate_cleanup_token(text) from public,anon,authenticated;
grant execute on function public.vybora_validate_cleanup_token(text) to service_role;
select cron.schedule('vybora-expired-video-cleanup','*/10 * * * *',
 $$select net.http_post(
   url:='https://lzmrvalonsxtapigtjcx.supabase.co/functions/v1/vybora-cleanup-expired-videos',
   headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_hxYPL9XPZlzwbtgAxpNC3Q_KtrMUY31',
   'x-cleanup-token',(select decrypted_secret from vault.decrypted_secrets where name='vybora_cleanup_token')),
   body:='{}'::jsonb,timeout_milliseconds:=10000) as request_id;$$);
commit;