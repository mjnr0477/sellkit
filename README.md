# VYBORA — Your universe, in motion

VYBORA is a guest-first short-video social experience. Its design direction is **Midnight Neon**: dark surfaces, electric violet, aqua accents, and a bold futuristic identity.

## Current implementation

- Full-screen vertical video feed with scroll snapping and automatic play/pause as cards enter/leave view.
- Guest browsing of public videos without registration.
- Supabase Auth email sign-up and sign-in.
- Authenticated video upload to the `vybora-media` Storage bucket.
- Online public-feed reads from `public.vybora_posts`.
- Registered-user comments, reactions/likes, and creator follows using VYBORA database tables.
- Responsive mobile navigation, discovery search, sound toggle, and account prompts when guests attempt restricted actions.
- Row Level Security on all VYBORA tables; Storage rules limit uploads/updates/deletes to the signed-in user's own folder.

## Backend

VYBORA currently uses the existing **Mariona** Supabase project in a dedicated `vybora_*` table namespace and the `vybora-media` Storage bucket. Dream Wi-Fi tables are retained separately and were not modified by the VYBORA frontend work. Dream Education uses a different project and is not part of this repository change.

The frontend uses the public Supabase publishable key only. Do not put a service-role key or secret key in browser code.

## Important release limitations

- The current featured demo videos are illustrative fallback content. The feed switches to uploaded community videos when available.
- This branch has had source-level checks, including JavaScript syntax parsing, but has **not** had a real-device/browser end-to-end run for registration, video playback, upload, and RLS behavior.
- Confirm email-verification settings, file-upload behavior on Android, moderation/reporting, abuse/rate limits, and production video delivery before launch.
- Do not merge or publish this branch as production-ready until those release checks pass.

## Preview

Open `index.html` in a modern browser with internet access. Supabase-backed account and media features require network access and the configured project to be available.
