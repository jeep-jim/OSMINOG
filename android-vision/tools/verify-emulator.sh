#!/usr/bin/env bash
set -euo pipefail
mkdir -p dist
cleanup() {
  adb logcat -d > dist/android-logcat.txt || true
  for name in vision-home vision-menu vision-conversation; do
    adb pull "/sdcard/$name.png" "dist/$name.png" || true
  done
}
trap cleanup EXIT
gradle :app:connectedDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.osminog.vision
adb shell pm clear com.osminog.vision
adb shell am start -S -W -n com.osminog.vision/.MainActivity
ready=0
for attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/vision-window.xml >/dev/null 2>&1 || true
  if adb shell cat /sdcard/vision-window.xml 2>/dev/null | grep -q 'Меню OSMINOG'; then ready=1; break; fi
  sleep 1
done
adb shell screencap -p /sdcard/vision-clean-launch.png
adb pull /sdcard/vision-clean-launch.png dist/vision-clean-launch.png
test "$ready" -eq 1
