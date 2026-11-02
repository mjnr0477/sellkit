-- A recipient can mark an incoming unread message as read once, but cannot clear or rewrite the marker.
alter policy "VYBORA recipients mark unblocked messages read"
on public.vybora_messages
using (
  recipient_id = (select auth.uid())
  and read_at is null
  and not private.vybora_is_blocked(sender_id)
)
with check (
  recipient_id = (select auth.uid())
  and read_at is not null
  and not private.vybora_is_blocked(sender_id)
);
