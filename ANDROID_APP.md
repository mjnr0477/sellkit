# VYBORA Android app

This repository builds an Android wrapper around the existing VYBORA frontend using Capacitor. The hosted website remains separate and is not replaced by the Android app.

## Build an APK in GitHub Actions

The `VYBORA Android APK` workflow installs Node.js, Java and the Android SDK, prepares `index.html` and `social-features.js`, generates the Capacitor Android project, and builds a debug APK. Download `vybora-android-debug-apk` from the completed workflow run's Artifacts section.

A debug APK is suitable for installation and testing; it is not a Play Store release. A signed release build and Play policy checks are separate steps.

## Local build

Requirements: Node.js 22, Java 21, Android SDK.

```sh
npm install
npm run android:sync
cd android
./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Authentication note

In the native app, email confirmation and password-recovery links are sent to the existing hosted VYBORA site. After confirming an account or changing a password there, return to the app and sign in. This avoids changing the shared Supabase project's global Site URL or redirecting Dream Wi-Fi authentication.

## Acceptance checks before release

- Install and launch on a real Android phone.
- Browse the feed and play supported external videos.
- Sign in, sign out, create an account and test password recovery with a real test account.
- Test friends, chat, video upload, camera/microphone permissions and live rooms with two accounts.
- Confirm links open safely and app back navigation behaves sensibly.
- Add the hosted site to Supabase Auth's allowed redirect URLs if it is not already present; do not change the shared project's global Site URL.
