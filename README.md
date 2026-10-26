# SellKit Signal Lab

SellKit Signal Lab is an Android diagnostic prototype for testing network connectivity and exploring receive-only SDR signal processing. It is **not currently a method for obtaining free mobile data or unrestricted internet**.

## Current capabilities

- Reports Android network state and performs user-triggered HTTPS reachability checks.
- Includes a nearby Wi-Fi scan flow that lists access points visible to the phone, subject to Android permissions, Wi-Fi state, and OS restrictions.
- Includes experimental DSP/frame-codec components and USB-host discovery/control/bulk-read plumbing intended for compatible RTL-SDR hardware.
- Unit tests cover synthetic signal processing, frame integrity, I/Q conversion/chunk assembly, USB-device discovery helpers, and USB transfer result handling.

## Important SDR limitations

USB enumeration or a successful USB transfer does not prove that an SDR has been initialized, tuned, or is delivering valid I/Q samples. The current USB bulk reader does not by itself configure the RTL2832U demodulator or identify and initialize every possible tuner. Hardware support still requires a documented, chipset/tuner-specific initialization sequence and testing with a real compatible receiver connected to an Android phone using USB OTG.

The experimental SignalFrameCodec is a private test framing format, not a published radio standard. Synthetic DSP tests show that code processes generated test samples; they do not establish that arbitrary over-the-air signals can be decoded.

## What this cannot do

- Wi-Fi signal strength, nearby access-point discovery, or radio reception does not create an internet connection.
- An RTL-SDR receiver does not authenticate with a mobile operator or bypass carrier billing.
- Reaching a website over cellular does not prove that the carrier zero-rates it. Verify billing and bundle balances with the operator.
- Internet access over radio requires a real data-bearing protocol, a compatible receiver, and a lawful/authorized source or service.

## Build and verify

The GitHub Actions workflow runs Android unit tests, builds a debug APK, and uploads it as a temporary workflow artifact. See the [Actions runs](https://github.com/mjnr0477/sellkit/actions).

For local builds, use Android Studio with JDK 17 and the Android SDK configured for this project, or run the workflow from GitHub. Install debug builds only on a test device.

## Real-device acceptance checklist

1. **Wi-Fi scan:** enable Wi-Fi and grant the requested runtime permissions; compare listed SSIDs, security details, and RSSI with Android's system Wi-Fi screen.
2. **Network diagnostics:** test with Wi-Fi and cellular separately. A successful HTTPS request proves reachability only for that endpoint at that time.
3. **USB host:** connect a known-compatible RTL-SDR using a suitable OTG adapter and confirm Android grants USB permission.
4. **RF capture:** do not label USB bytes as I/Q until the correct device and tuner initialization sequence is implemented and verified; compare captured samples with a known reference.
5. **Over-the-air decoding:** test only a known, lawful, documented signal/protocol with synthetic fixtures and independently verified reference captures.
6. **Internet goal:** demonstrate a real authorized data path end to end. A signal detector or synthetic decoder alone does not meet this requirement.

## Status

This is an experimental diagnostic lab. Automated CI passing means the current source tests and debug build pass; physical SDR compatibility, over-the-air decoding, carrier billing outcomes, and any internet-access claim require separate real-device evidence.
