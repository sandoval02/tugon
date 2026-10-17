# Downloads folder

Put your release builds here with these exact names (or edit `RELEASE` at the
bottom of `../index.html`):

- `tugon.apk`  — `flutter build apk --release` → `build/app/outputs/flutter-apk/app-release.apk`
- `tugon.ipa`  — built on a Mac / Codemagic (`codemagic.yaml`) → `.ipa`

Until a file exists the matching button shows "Coming soon" automatically.
Remember to set `EnvironmentConfig.useProduction = true` in the Flutter app
before building the release.
