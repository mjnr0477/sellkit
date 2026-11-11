# VYBORA Real-App Experience

## Product decision

VYBORA remains a guest-first social video app, not a landing page and not a clone of one existing short-video network. Its primary job is to let people open the app and immediately discover playable video, then move naturally into creator, community, live, and account features.

The current vanilla HTML/CSS/JavaScript architecture, Supabase project, vybora_* tables, and existing Render static-site deployment remain the product foundation. This change is a focused experience pass, not a framework migration or a database redesign.

## Audience and primary jobs

- Guests: watch real public videos without registering.
- Members: publish short clips, react, comment, save, follow creators, connect with friends, chat, and join or host live rooms.
- Creators: understand who is posting and make their identity and captions visible.
- Returning viewers: move through a feed comfortably, with optional hands-free progression for compatible direct video clips.

## Experience requirements

1. The Watch feed must make the video the main event while keeping creator name, handle, caption, follow action, and required content credits readable.
2. The feed must never be filled with invented demo videos. Real community posts and verified/open-licensed public media remain the content sources.
3. Direct video playback remains lazy-loaded, muted by default, and paused when off-screen. Data Saver remains available.
4. Optional Focus mode is explicit, off by default, stored locally, and advances to the next card only when a direct video naturally finishes. Provider-hosted iframe players do not expose a reliable end event; Focus mode must not pretend they do.
5. Live rooms and verified event streams must be readable and navigable as a scrollable live hub. Event identity and playback context must remain visible around the player.
6. Desktop layout may use the existing discovery/sidebar content; small screens prioritize the video and retain the complete bottom navigation.
7. Sign-in remains optional for viewing. Existing authenticated actions and account/session behavior must be preserved.
8. Loading, empty, provider-unavailable, and no-more-content states must be understandable and must not imitate live content.

## Visual direction

Retain VYBORA's established Midnight Neon identity: ink-black and indigo surfaces, controlled violet light, mint interaction states, and a restrained pink accent. The memorable signature is the cinematic full-height Watch stage with a clear creator/caption rail and a compact action column—not a wall of glowing cards.

This is a product surface, so clarity and touch usability outrank decorative effects. The desktop sidebar is a secondary discovery surface; on mobile it gives way to the full-width feed. Motion is limited to feedback and natural progression, and reduced-motion preferences are respected.

## Scope

Included:
- Replace the over-minimal feed styling that currently hides almost all creator and caption content.
- Restore useful desktop discovery context while keeping mobile feed-first layout.
- Correct Live hub sizing so room lists, search, and verified event cards remain reachable.
- Make official live embeds contextual cards rather than fullscreen players that hide event information.
- Add optional Focus mode for compatible direct video playback.
- Update the design and UX contracts plus regression tests and offline cache version.

Not included:
- New paid APIs, video hosting vendors, or frontend framework dependencies.
- Database schema changes or changes to Supabase Auth, RLS, storage, billing, or unrelated apps.
- Guaranteed autoplay of third-party iframe providers.
- A TURN relay service, professional transcoding/CDN, or claims of unlimited live-stream scale. These require infrastructure decisions beyond a frontend pass.

## Acceptance checks

- Existing guest, signup/sign-in, upload, follow, comment, save, share, moderation, and live features remain wired to the current systems.
- Mobile layout has no horizontal overflow or overlapping top controls at 360px and 390px widths.
- Creator identity and captions are visible and interactive on Watch cards.
- Desktop sidebar is present; mobile sidebar is hidden without removing its workflows from navigation.
- Live room cards, live search, and official video context remain in the scrollable live hub.
- Focus mode off preserves normal looping; Focus mode on disables looping and advances after a direct video's ended event only.
- Reduced-motion users receive non-animated scroll progression.
- Project verification and frontend regression tests pass before merge.
