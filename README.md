# SellKit Signal Lab

An Android experiment to measure cellular network state and verify real HTTPS connectivity over mobile data. It does not unlock free data, bypass carrier billing, or turn signal strength into internet access.

## What it tests
- Active network transport and whether Android reports internet capability/validation.
- Mobile-network status separately from Wi-Fi.
- A user-triggered HTTPS request to a small connectivity-check endpoint.
- Repeatable comparisons with Wi-Fi disabled, with/without an active data bundle, and with/without any legitimate promotional data.

## Build
Open this repository in Android Studio, or use the GitHub Actions workflow to build a debug APK. Install the APK on an Android phone and grant network permissions when prompted (the app uses normal INTERNET and ACCESS_NETWORK_STATE permissions only).

## Experiment protocol
1. Turn Wi-Fi off and record the SIM/network shown by Android.
2. Run the HTTPS test with an active data bundle as a positive control.
3. Repeat without a bundle. Do not infer a bypass from cached content or signal bars; record whether the request actually succeeds and whether the carrier may be providing promotional/zero-rated access.
4. Repeat tests and compare results. A failed test means this endpoint was unreachable at that moment; it does not by itself prove no other internet route exists.

The app is a diagnostic prototype, not a mechanism for obtaining free internet. Real-device testing is required.