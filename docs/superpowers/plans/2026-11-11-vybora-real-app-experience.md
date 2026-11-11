# VYBORA Real-App Experience Implementation Plan

> **For agentic workers:** Implement task-by-task and verify each task. Steps use checkbox syntax for tracking.

**Goal:** Turn VYBORA's existing video-first website into a coherent, usable social-video app experience without replacing its backend or inventing content.

**Architecture:** Keep the single-page vanilla HTML/CSS/JavaScript app and current Supabase vybora_* integration. Apply a focused visual layer in clean-feed.css, add explicit optional Focus mode to the existing playback controller in index.html, and update cache/test contracts in the same feature branch.

**Tech Stack:** HTML, CSS, browser JavaScript, Supabase JS v2, Node built-in test runner, GitHub Actions, Render static site.

**Spec:** docs/superpowers/specs/2026-11-11-vybora-real-app-experience.md

## Global Constraints

- Keep guest viewing available without sign-in.
- Preserve existing authentication, uploads, social actions, friends/chat, and live-room logic.
- Never invent demo videos, views, likes, creator names, or live status.
- Keep video sources lazy-loaded and off-screen playback paused.
- Focus mode is off by default and advances only direct video elements on their actual ended event.
- Do not claim third-party iframe end detection, guaranteed playback, or production-scale live infrastructure.
- Do not alter Supabase schema/RLS, other apps, or the Render service configuration.
- Add no new frontend dependency and keep the existing mobile navigation.

## Review Focus

- 360px phone width with all header controls present: no clipping or overlapping.
- A direct video naturally ends while Focus mode is enabled: advance once to the next card.
- An iframe-hosted stream is active in Focus mode: do not fabricate an end event or force an arbitrary timer skip.
- Provider discovery fails or returns no public clips: show an honest empty/degraded state and preserve already loaded content.
- A live-event player loads: keep event title, competition/team context, and surrounding room list reachable.

---

### Task 1: Establish the VYBORA product and design contracts

**Files:** Create DESIGN.md, UX-CONTRACT.md, the feature spec, and this plan.

**Interfaces:** Runtime tokens remain owned by existing CSS variables; design docs mirror rather than generate them. UX decisions remain anchored to existing Watch, Discover, Live, Create, Following, and Profile workflows.

- [x] Record the feature scope and acceptance checks.
- [x] Record the current visual token system and product behavior.

---

### Task 2: Rebuild the Watch and Live presentation layer

**Files:** Modify clean-feed.css; test tests/vybora-frontend.test.cjs.

**Interfaces:** Preserve the existing video-card, video-info, creator, video-caption, video-actions, live-hub, live-event-card, and official-live-player markup. Keep required creator credits clickable and visible. Maintain a full-height Watch card without forced scroll snapping.

- [x] Restore creator identity, handle/time, follow action, caption, recommendation explanation, and required source credits.
- [x] Restore a secondary desktop discovery rail; hide it only on mobile.
- [x] Make the Live hub content-height and scrollable, and retain official event context around embeds.
- [x] Add responsive regression assertions.

---

### Task 3: Add opt-in Focus mode to existing playback

**Files:** Modify index.html; test tests/vybora-frontend.test.cjs and tests/vybora-browser-smoke.cjs.

**Interfaces:** New button #focusModeBtn; state exposed through aria-pressed; local preference key vybora:focus-mode:v1. Existing activateVideoObserver remains the only owner of video/iframe activation. A feed-level capture listener handles the non-bubbling native ended event.

- [x] Add an accessible Focus mode utility control.
- [x] Apply video.loop = !focusMode as cards become active and when the user toggles the setting.
- [x] Advance to the next video card on a genuine direct-video ended event.
- [x] At the end of loaded content, request the next page and advance when a new card arrives; never auto-skip an iframe on a timer.
- [x] Add regression coverage for opt-in state, end-event handling, and narrow header geometry.

---

### Task 4: Refresh offline cache and run verification

**Files:** Modify service-worker.js, README.md, tests/vybora-frontend.test.cjs, and tests/vybora-browser-smoke.cjs.

**Interfaces:** Cache name becomes vybora-shell-v5. Public app shell remains network-first for application logic; Supabase auth/REST/storage responses remain uncached.

- [x] Bump the offline shell cache version.
- [x] Document the Focus mode contract and known iframe limitation.
- [x] Run npm run verify (passed in GitHub Actions).
- [ ] Run node --test tests/clean-feed.test.cjs tests/video-startup-contract.test.cjs tests/vybora-frontend.test.cjs (re-run after correcting the source-selector assertion).
- [ ] Review the branch diff, open a PR, and wait for required GitHub checks before merging.
- [ ] Confirm Render's automatic deploy and inspect the resulting service status before calling the change live.
