# VYBORA — Your universe, in motion

VYBORA is a guest-first short-video social experience. Its design direction is **Midnight Neon**: dark surfaces, electric violet, aqua accents, and a bold futuristic identity.

## Current implementation

- Full-height vertical video feed with natural scrolling, lazy-loaded media, muted autoplay, and off-screen pause.
- Guest browsing of public videos without registration.
- Supabase Auth email sign-up, sign-in, and password recovery UI.
- Authenticated video uploads to the `vybora-media` Storage bucket.
- Online public-feed reads from `public.vybora_posts`.
- Registered-user comments, likes/reactions, bookmarks with a saved-video library, profile editing, and creator follows.
- Responsive mobile navigation, discovery search, sound toggle, optional device-local Focus mode, and sign-in prompts for member-only actions.
- Row Level Security on VYBORA tables; media writes are restricted to the signed-in user's own storage folder.
- Aggregate like counts stored separately from reaction identities; users cannot write aggregate totals directly.
- Versioned schema and RLS setup in `supabase/migrations/20261026170000_vybora_social_schema.sql`.

## Preview

**Production:** https://vybora-social-live-8yyn.onrender.com\n\n**Hosted preview:** https://vybora-social-preview-yb6x.onrender.com

This is a separate static preview deployed from `feat/vybora-social-universe-mvp`, not the production `main` branch.

## Backend and authentication setup

VYBORA uses the existing **Mariona** Supabase project in a dedicated `vybora_*` table namespace and the `vybora-media` Storage bucket. Dream Wi-Fi tables remain separate and were not modified by the VYBORA frontend work. Dream Education uses a different project and is not part of this repository change.

The frontend uses the public Supabase publishable key only. Never put a service-role key or secret key in browser code.

**Important shared-project setting:** because Mariona is also used by Dream Wi-Fi, do not replace its global Auth Site URL. Add `https://vybora-social-preview.onrender.com/**` to Supabase Auth's allowed redirect URLs so VYBORA email confirmation and password-reset links can return to this preview without changing Dream Wi-Fi's default redirect.

## Verification and release readiness

- GitHub Actions checks frontend regressions and JavaScript syntax.
- A Playwright smoke test checks the hosted mobile guest feed, account gates, and sign-in/password-recovery controls.
- The single featured fallback video is explicitly a preview only; the feed switches to real community uploads and verified open-source videos when available. Feed scroll loading is animation-frame throttled, with lazy media loading and no forced snap-stop. Creator identity, follow controls, captions, and required source credits stay visible on the Watch card. Optional Focus mode disables looping and advances compatible direct video clips on their actual end event; third-party iframe players keep their own playback controls.
- The Watch feed discovers free-to-watch, openly licensed videos at runtime from Internet Archive, Wikimedia Commons, Openverse, NASA, Blender Open Movies, and the federated PeerTube network. PeerTube results are filtered to public, non-mature streams and embedded directly from their originating instances; source publishers retain control of playback and content. Openverse results prioritize recently indexed media. Results are held in page memory only; imported source-video bytes are never copied into VYBORA storage. VYBORA does not upload or persist these source-video bytes in Supabase Storage or tables. Supabase remains used for users' own uploads and social data; external curated-link records, where configured, are metadata only.
- The Live tab prioritizes VYBORA creator rooms, then adds public, non-mature live streams from the federated PeerTube network only after a second live-state check against the originating instance. Live embeds load when their cards enter view and are released when scrolled away, while event title and competition/team context remain visible. Public trending PeerTube videos are paginated in the Watch feed; Data Saver reduces the page size. It also displays registered official event streams only as in-app embeds when marked live, verified within the last hour, not past their end time, and using an allow-listed HTTPS embed host (YouTube, Vimeo, Twitch, Dailymotion, and Kick; Twitch embeds receive the required parent-domain parameter). It does not show outbound watch links or provider/source labels. Event availability still depends on the rights holder supplying a working, embeddable stream; no third-party service can be made embeddable or free by frontend code.
- Registered-user email confirmation, password reset email delivery, actual video upload/playback, and the full signed-in data workflow still require a real account/browser-device acceptance test.
- Configure content reporting/moderation, abuse/rate limits, and a production-grade video delivery/transcoding path before broad launch.
- Keep this branch isolated until the remaining account and upload acceptance checks pass. Dream Education and Dream Wi-Fi must not be merged into or modified by VYBORA changes.
