# VYBORA moderation roles

The VYBORA safety desk is restricted to trusted Supabase Auth `app_metadata` claims. The client never accepts a moderator role from editable `user_metadata`.

## Assign the first administrator

Only the Supabase project owner should do this:

1. Open the VYBORA Supabase project.
2. Go to **Authentication → Users**.
3. Open the intended owner account.
4. Add this property to the account's trusted **app_metadata** JSON, preserving any existing metadata keys:

```json
{
  "vybora_role": "admin"
}
```

5. Save, then sign out and sign back into VYBORA so the refreshed JWT includes the role.

For additional staff, use `"vybora_role": "moderator"` only for people trusted to review user reports. Never set this in `user_metadata` or from browser/client code.

## Use the safety desk

After signing in again, open **Profile → Open safety desk**. Moderators can view the newest 100 reports, mark a report reviewing, resolve, dismiss, or reopen it, and add private notes. Review actions are recorded in the private audit log. Ordinary accounts cannot read the moderation queue or audit notes.

## Role removal

Remove `vybora_role` from the account's `app_metadata` and have that user sign out and back in. The server-side checks deny access when the trusted claim is absent.
