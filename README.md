# Ambient Radiation Internet — Research Prototype

Mission: investigate whether ambient electromagnetic transmissions can be turned into usable phone connectivity, starting with measurements on a stock Android phone.

This branch is a fresh prototype, separate from Dream Education and Dream Wi-Fi. It does not claim to create internet from radio energy. The first build measures discoverable Wi-Fi transmitters, cellular radio readings exposed by Android, and ordinary internet reachability. Later work must experimentally establish whether any detected transmission provides a usable data channel and a return path.

## First milestone
- Install on Android 13+
- Read available Wi-Fi scan results after permission is granted
- Read cellular measurements exposed by Android when permitted
- Test whether the phone already has an internet route
- Clearly distinguish signal detection from internet access

## Build
Open this repository in Android Studio or use the included GitHub Actions workflow to build the debug APK.

## Safety and truthfulness
Do not represent a detected signal, signal bars, or harvested RF energy as an internet connection. No credentials, billing bypass, or carrier restrictions are altered by this prototype.
