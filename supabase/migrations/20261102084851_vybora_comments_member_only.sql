-- VYBORA comments require an account; guests cannot read member conversations.
begin;
drop policy if exists "Guests can read comments on public VYBORA posts" on public.vybora_comments;
revoke select on public.vybora_comments from anon;
commit;
