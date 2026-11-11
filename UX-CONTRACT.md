# VYBORA UX Contract

## Product context

- **Audience:** Guests, creators, and members of the VYBORA community.
- **Primary jobs:** Watch public video; discover creators; publish clips; follow, react, comment, and save; connect with friends; host and join live rooms.
- **Active UI locale:** English, with creator content preserved as published.
- **Accessibility target:** Semantic buttons and forms, keyboard-visible focus, reduced-motion support, and touch-friendly controls.

## Business-context sources

| Domain | Authoritative project source | Notes |
|---|---|---|
| Current feature scope | README.md | Guest-first video and social functionality |
| Data/auth implementation | index.html, social-features.js | Implementation evidence; Supabase public client key only |
| Database access and row policies | supabase/migrations/ | Existing vybora_* schema and RLS; do not bypass |
| Media cleanup | supabase/functions/vybora-cleanup-expired-videos/ | Existing scheduled/edge cleanup behavior |

## Visual and token ownership

- **Visual identity:** DESIGN.md.
- **Runtime token owner:** Base app variables in index.html; scoped `--vb-*` component tokens in clean-feed.css.
- **Component layer:** clean-feed.css, including the scoped `--vb-*` palette used by the new Watch/Live surface.
- **Drift policy:** Update the runtime CSS and DESIGN.md in the same change when a durable token changes.

## Canonical navigation

| Destination | Entry | Guest behavior | Member behavior |
|---|---|---|---|
| Watch | Bottom navigation | Browse public video | Personalized public and community feed |
| Discover | Bottom navigation / search | Search public videos | Search videos and discover creators |
| Live | Bottom navigation / header Live | Browse verified public streams where available | Browse, join, and host VYBORA live rooms |
| Create | Bottom navigation | Prompt for account | Publish a short video |
| Following | Bottom navigation | Prompt for account | View followed creators |
| Profile | Bottom navigation | Prompt for account | Edit profile and access saved/profile features |

## Interaction invariants

- Guests may watch public content without an account.
- Posting, following, liking, commenting, saving, messaging, and hosting live are authenticated actions.
- Every server mutation keeps the current Supabase/RLS boundary; frontend controls are not authorization.
- The video source is lazy-loaded when its card approaches the viewport. Off-screen videos pause; default playback is muted.
- Data Saver defers source bytes and reduces external page sizes.
- Focus mode is opt-in and device-local. It disables looping for direct video elements and advances only on a real ended event. Iframe streams remain governed by their provider.
- Search results and live streams keep their current content/verification rules and attribution.
- Video deletion, moderation, and account controls retain their existing confirmations and permissions.

## Feedback and resilience

- The feed starts with a neutral loading message, not placeholder creator metrics.
- A failed direct video is replaced with a clear discovery cover rather than an empty black card.
- Provider failures must not be shown as an empty successful catalogue; preserve loaded videos and explain degraded discovery.
- A control gives feedback only after the action/state change is real.
- Reduced-motion preference changes smooth auto-advance to immediate navigation.
- Do not cache authenticated Supabase API responses in the service worker.

## Out of scope

No new billing, external video vendor, schema migration, media-transcoding service, TURN infrastructure, or replacement framework is part of the current UI pass.
