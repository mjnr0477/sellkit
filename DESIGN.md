---
version: alpha
name: "VYBORA"
description: "A guest-first social video universe with a cinematic Midnight Neon watch stage and direct creator context."
colors:
  primary: "#9B55FF"
  secondary: "#50F0D0"
  accent: "#FF4FC8"
  background: "#05050C"
  surface: "#10101C"
  surfaceRaised: "#171629"
  border: "#34304E"
  text: "#FBFAFF"
  muted: "#B4B0CA"
  focus: "#50F0D0"
  danger: "#FF7F9B"
  success: "#6FE4BC"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.375rem"
  full: "999px"
spacing:
  page-gutter: "clamp(0.5rem, 2vw, 1.5rem)"
  panel-gap: "1rem"
  panel-padding: "1.125rem"
  feed-max-width: "38rem"
  sidebar-width: "18rem"
  touch-target: "2.75rem"
components:
  button: "Primary violet-to-pink gradient; neutral dark outline; 44px preferred touch target."
  card: "Ink surfaces with quiet violet border; reserve glow for active or live states."
  dialog: "Dark modal with clear title, close control, and readable form fields."
---

# VYBORA Design System

## Overview

### Creative North Star

A compact late-night screening room for the internet: the moving picture owns the room, the creator and caption sit in a legible lower-third, and the interface behaves like a set of carefully placed playback controls. The atmosphere is Midnight Neon, but the interface is not a nightclub flyer.

### Product context and register

- **Audience and primary job:** Guests discover and watch public video; members create, follow, discuss, save, and join live rooms.
- **Target market(s) and evidence:** The repository describes VYBORA as a guest-first global social video experience; this design does not infer a geography.
- **Locale(s) and language policy:** English UI with system-font fallbacks; creator content remains in the language it was published in.
- **Usage scene:** Primarily handheld phone, often one-handed, with desktop browsing also supported.
- **Register:** Product-first hybrid. Watch is immersive; navigation, account, search, and moderation remain clear utility surfaces.
- **Memorable signature:** Full-height video stage with a real creator lower-third and a restrained vertical action rail.
- **Restraint:** Captions, creator identity, playback controls, credits, and touch targets remain readable; no decorative glow competes with the video.
- **Anti-references:** Avoid anonymous video walls that hide creators, dense action stacks, and interfaces that look like static marketing mockups.
- **Token ownership/runtime mapping:** The original app variables (`--bg`, `--panel`, `--panel2`, `--line`, `--text`, `--muted`, `--violet`, `--aqua`, `--pink`) remain defined in index.html. The refreshed Watch/Live layer uses scoped `--vb-*` presentation tokens in clean-feed.css. DESIGN.md records the scoped component palette; keep the relationship explicit and avoid another token package.

## Colors

Midnight surfaces establish depth without black-on-black ambiguity. Violet (#9B55FF) is the primary brand action; mint (#50F0D0) denotes active, focus, and selected states; pink (#FF4FC8) is a sparing accent. Text uses near-white (#FBFAFF) with muted lavender (#B4B0CA). The #34304E border token separates surfaces. Errors and success must include explicit text, not color alone.

## Typography

Inter/system UI is used for headings, controls, captions, and body copy so the app does not depend on a remote font. Use bold display weights for the brand and short headings; normal weights for captions and long-form descriptions. Creator handles, timestamps, and counts are utility text and must remain readable rather than disappearing behind the video.

## Layout

- Desktop: centered product shell, video stage at up to 38rem, secondary discovery rail around 18rem.
- Mobile: 58px header, flexible full-height feed, safe-area-aware 65px bottom navigation. The sidebar is hidden, but every important workflow remains accessible through navigation or header controls.
- Feed: one card per viewport; continuous natural vertical movement, no forced snap-stop.
- Live: a scrollable hub with content-height cards; embedded players retain a 16:9 context block rather than taking over the entire screen.
- Controls: target at least 44px where practical; compact header utilities may use 32px only where their accessible names remain available and the action is non-primary.

## Elevation & Depth

Use a subtle radial indigo ambience behind the app shell, layered ink panels, one-pixel violet/indigo boundaries, and soft shadows on dialogs. Video overlays use a strong bottom gradient for legibility. Avoid heavy blur or neon glow on every panel.

## Shapes

Use 12–22px radii on panels, modals, and feed frames; round pills for compact topics and follow actions; circular icon surfaces for video actions. The video itself may reach the viewport edge on mobile.

## Components

### Foundational visual states

- Default controls: high-contrast text on dark surface.
- Hover/pressed: slightly brighter surface with border emphasis.
- Focus-visible: mint outline with visible offset.
- Selected/active: mint text or outline plus aria-pressed/current state.
- Disabled: reduced opacity and no pointer affordance.
- Busy: preserve button width and label context.
- Error/empty/loading: concise text in the affected region with a clear retry or next step when possible.

### Buttons and actions

One primary action per decision area. Use specific verbs: Join live, Publish video, Save video, Follow. Utility icon buttons require accessible labels and tooltips. Keep the action rail compact enough not to cover captions or creator information.

### Navigation and data display

Use the existing six destinations: Watch, Discover, Live, Create, Following, Profile. The current destination uses mint emphasis. Keep the desktop discovery rail secondary; do not duplicate the primary navigation in it.

### Forms and overlays

Reuse the existing modal and form markup. Maintain visible labels, clear close controls, and readable errors. Do not replace authentication or upload flows as part of a visual change.

### Iconography

Use the existing text/symbol icon language for now. Do not add an icon dependency; ensure every symbol-only action has an accessible label.

### Motion

Natural scroll is the primary movement. Focus mode is optional and off by default; for direct videos it advances when playback ends. Third-party iframe providers are not assumed to expose playback events. Respect prefers-reduced-motion.

### Content and data visualization

Use direct, friendly product language. Never fabricate creators, views, reactions, or live status. Credits and reuse terms must remain visible when a public source requires attribution.
