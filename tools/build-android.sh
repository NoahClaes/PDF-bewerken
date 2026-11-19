#!/usr/bin/env bash
# Bouwt de Android-app (APK) met Apache Cordova.
# Gebruik: tools/build-android.sh debug|release
# Voor release zijn ANDROID_KEYSTORE_B64 en ANDROID_KEYSTORE_PASS nodig (GitHub-secrets).
set -euo pipefail
MODE="${1:-debug}"
cd "$(dirname "$0")/.."
V=$(node -p "require('./package.json').version")
IFS=. read -r MA MI PA <<< "$V"
CODE=$((MA * 10000 + MI * 100 + PA))
python3 tools/make-android.py
mkdir -p dist-android
cd android
sed -i "s/version=\"0.0.0\" android-versionCode=\"1\"/version=\"$V\" android-versionCode=\"$CODE\"/" config.xml
npm install --no-audit --no-fund
rm -rf platforms plugins
npx cordova platform add android@13.0.0 --nosave
npx cordova plugin add ./pdfb-plugin --nosave
if [ "$MODE" = "release" ]; then
  KS="${RUNNER_TEMP:-/tmp}/pdfb.keystore"
  printf '%s' "$ANDROID_KEYSTORE_B64" | base64 -d > "$KS"
  npx cordova build android --release -- --packageType=apk --keystore="$KS" --storePassword="$ANDROID_KEYSTORE_PASS" --alias=pdfb --password="$ANDROID_KEYSTORE_PASS"
  cp platforms/android/app/build/outputs/apk/release/app-release.apk "../dist-android/PDF-Bewerken-$V.apk"
  rm -f "$KS"
else
  npx cordova build android --debug -- --packageType=apk
  cp platforms/android/app/build/outputs/apk/debug/app-debug.apk ../dist-android/PDF-Bewerken-debug.apk
fi
git checkout -- config.xml 2>/dev/null || true
ls -la ../dist-android
