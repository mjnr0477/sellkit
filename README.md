# VYBORA — Your universe, in motion

VYBORA is a guest-first short-video social experience. Its design direction is **Midnight Neon**: dark surfaces, electric violet, aqua accents, and a bold futuristic identity.

## Current implementation

- Full-screen vertical video feed with scroll snapping and automatic play/pause as cards enter/leave view.
- Guest browsing of public videos without registration.
- Supabase Auth email sign-up and sign-in.
- Authenticated video uploads to the `vybora-media` Storage bucket.
- Online public-feed reads from `public.vybora_posts`.
- Registered-user comments, likes/reactions, bookmarks, profile editing, and creator follows.
- Responsive mobile navigation, discovery search, sound toggle, and sign-in prompts for guest-only restrictions.
- Row Level Security on VYBORA tables; media writes are restricted to the signed-in user's own storage folder.
- Aggregate like counts stored separately from reaction identities; users cannot write aggregate totals directly.

## Backend

VYBORA uses the existing **Mariona** Supabase project in a dedicated `vybora_*` table namespace and the `vybora-media` Storage bucket. Dream Wi-Fi tables remain separate and were not modified by the VYBORA frontend work. Dream Education uses a different project and is not part of this repository change.

The frontend uses the public Supabase publishable key only. Never put a service-role key or secret key in browser code.

## Release checks still required

- Featured fallback videos are illustrative demo content; the feed switches to real community uploads when available.
- Automated source regression checks and JavaScript syntax checks are configured in GitHub Actions.
- Browser/device end-to-end testing is still needed for email confirmation, sign-in, actual video playback and upload, and guest/registered access behavior.
- Configure email confirmation and password recovery, content reporting/moderation, abuse/rate limits, and a production-grade video delivery/transcoding path before broad launch.
- Keep this branch isolated until runtime checks pass. Dream Education and Dream Wi-Fi must not be merged into or modified by VYBORA changes.

## Preview

Open `index.html` in a modern browser with internet access. Supabase-backed account and media features require network access and the configured project to be available.
