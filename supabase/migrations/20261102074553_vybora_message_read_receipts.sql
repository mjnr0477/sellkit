-- Permit recipients to update only the read marker; RLS still limits rows to their own incoming messages.
grant update(read_at) on public.vybora_messages to authenticated;
