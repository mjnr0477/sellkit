# VYBORA Android app

VYBORA's Android package is a Capacitor wrapper around the existing hosted VYBORA frontend. The hosted website remains a separate deployment; changing the Android package does not by itself change the website.

## Live website updates

The Android package is configured to open `https://vybora-social-live.onrender.com/` through a small local launcher instead of bundling a frozen copy of the frontend. After this launcher is installed, normal frontend changes deployed to the hosted website should appear in the app without a new APK upload. Backend/content changes can also appear without reinstalling when served by the updated backend.

This is a hybrid WebView approach and requires internet access to load the live interface. Keep the launch destination fixed to the official HTTPS site; do not accept a URL from user input. Changes to native Android code, permissions, app identity, or other bundled native resources still require a new app release. Test login/session persistence, video playback/autoplay, live camera/microphone permissions, navigation, and offline recovery on a physical device before distributing the updated package.

## Current release workflow

The GitHub Actions workflow `.github/workflows/android-apk.yml` builds **release-signed candidate packages**, not debug packages. On a successful push to `main`, it builds:

- `app-release.apk` — for direct installation and device testing.
- `app-release.aab` — for a future Play Console submission.

The workflow requires the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. It verifies that both output files exist, uploads short-retention workflow artifacts, and publishes a GitHub prerelease. A green build proves packaging succeeded; it does **not** prove every product feature works on a physical phone or that the app is ready for a broad public launch.

## Downloading a candidate

1. Open the latest **VYBORA Android build** prerelease in GitHub Releases.
2. Download `app-release.apk` to install on an Android phone. Do not try to install the `.aab`; it is a store-submission bundle.
3. Verify the release asset checksum when a published checksum is available.
4. Install and run the app on a real device before relying on it.

## Local debug build

Requirements: Node.js 22, Java 21, Android SDK.

```sh
npm install
npm run android:sync
cd android
./gradlew assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. A local debug APK is distinct from the signed release candidate.

## Shared Supabase project safety

VYBORA uses the Mariona Supabase project in a dedicated `vybora_*` namespace, which is also used by Dream Wi-Fi. Do not change the global Supabase Auth Site URL, delete shared auth users, or run broad schema/permission changes as a VYBORA-only fix. Add only the required VYBORA callback URLs to the allowed redirect URL list, after verifying the exact production and preview URLs. Never put a service-role key or other secret in browser or Android client code.

Email confirmation and password-recovery links are handled by the hosted VYBORA site. Test these flows with a dedicated real test account; do not use a production user's credentials.

## Release acceptance gate

Treat a release as a **candidate**, not production-ready, until all applicable checks below have passed and their results are recorded.

### Automated checks

- [ ] Frontend regression and JavaScript syntax checks pass on the exact release commit.
- [ ] Social/database contract checks pass.
- [ ] Hosted browser smoke test passes against the intended production deployment.
- [ ] Android APK and AAB build, signing, and artifact checks pass.
- [ ] No unresolved high-severity security finding is being silently waived.

### Real-account and real-device checks

- [ ] Install, launch, background, resume, and uninstall/reinstall on a physical Android device.
- [ ] Create a test account; verify email confirmation, sign-in, sign-out, expired-session handling, and password recovery.
- [ ] Confirm guest browsing works and protected actions request sign-in without losing unrelated feed state.
- [ ] Upload a test image/video on mobile data and Wi-Fi; verify upload errors, retry behavior, playback, and ownership/privacy rules.
- [ ] Test scrolling, pause/play, sound, search, likes, comments, bookmarks, follow/unfollow, and profile edits with real accounts.
- [ ] Test friend requests and private messaging using two accounts; verify a non-friend cannot read or send private messages.
- [ ] Test camera/microphone permissions and live-room join/leave, reconnect, and error states using two physical devices on different networks. STUN-only WebRTC can fail across some NATs; validate real-world connectivity before claiming reliable live video.
- [ ] Verify every visible event/video link opens the intended legitimate source, is labelled accurately, and handles unavailable or region-restricted content gracefully.
- [ ] Exercise report submission and verify an authorized moderator can actually review and act on reports before enabling broad user-generated-content launch.
- [ ] Verify privacy notice, community rules, blocking/reporting expectations, and a safe account-deletion path before inviting the public.
- [ ] Confirm Android back navigation, external links, keyboard/input behavior, small-screen layout, and network-loss/recovery states.

### Known limitations to resolve or explicitly accept before broad launch

- Automated guest-browser smoke tests do not replace real-account testing of email confirmation, password recovery, uploads, private messaging, and live rooms.
- Live-room connectivity must be tested across real networks; a successful Android build cannot prove WebRTC connectivity.
- Reporting UI alone is not a complete moderation operation. Reports need a secure review/action process.
- Privacy and account-deletion behavior must be verified against the shared Supabase project without affecting Dream Wi-Fi.
- A live-event catalog can be empty or events can be region-restricted. Do not promise that a match is currently streaming unless the source and availability are verified.

## Release decision

Only describe VYBORA as ready for a wider public launch after the acceptance gate has been completed, remaining limitations have owners and documented decisions, and the exact candidate has been tested. If a check cannot be performed without a real phone, real account, or provider-console access, record it as **not verified** rather than marking it passed.
