# VYBORA — Your universe, in motion

VYBORA is a guest-first short-video social experience. Its design direction is **Midnight Neon**: dark surfaces, electric violet, aqua accents, and a bold futuristic identity.

## Current implementation

- Full-screen vertical video feed with scroll snapping and automatic play/pause as cards enter/leave view.
- Guest browsing of public videos without registration.
- Supabase Auth email sign-up and sign-in.
- Authenticated video uploads to the `vybora-media` Storage bucket.
- Online public-feed reads from `public.vybora_posts`.
- Registered-user comments, likes/reactions, bookmarks with a saved-video library, profile editing, and creator follows.
- Responsive mobile navigation, discovery search, sound toggle, and sign-in prompts for guest-only restrictions.
- Row Level Security on VYBORA tables; media writes are restricted to the signed-in user's own storage folder.
- Aggregate like counts stored separately from reaction identities; users cannot write aggregate totals directly.
- Versioned schema and RLS setup in `supabase/migrations/20261026170000_vybora_social_schema.sql`.

## Preview

**Hosted preview:** https://vybora-social-preview.onrender.com

This is a separate static preview deployed from `feat/vybora-social-universe-mvp`, not the production `main` branch.

## Backend

VYBORA uses the existing **Mariona** Supabase project in a dedicated `vybora_*` table namespace and the `vybora-media` Storage bucket. Dream Wi-Fi tables remain separate and were not modified by the VYBORA frontend work. Dream Education uses a different project and is not part of this repository change.

The frontend uses the public Supabase publishable key only. Never put a service-role key or secret key in browser code.

## Verification and release readiness

- GitHub Actions checks frontend regressions and JavaScript syntax.
- A Playwright smoke test checks the hosted mobile guest feed and account gates.
- The current featured fallback videos are illustrative demo content; the feed switches to real community uploads when available.
- Registered-user email confirmation, password recovery, actual video upload/playback, and the full signed-in data workflow still require a real account/browser-device acceptance test.
- Configure content reporting/moderation, abuse/rate limits, and a production-grade video delivery/transcoding path before broad launch.
- Keep this branch isolated until the remaining account and upload acceptance checks pass. Dream Education and Dream Wi-Fi must not be merged into or modified by VYBORA changes.
