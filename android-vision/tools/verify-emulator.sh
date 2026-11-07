#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
cleanup() {
  timeout 12s adb logcat -d > dist/android-logcat.txt || true
  timeout 12s adb shell dumpsys activity activities > dist/activity-state.txt || true
  for name in vision-home vision-menu vision-conversation vision-notice vision-update; do
    timeout 12s adb pull "/sdcard/$name.png" "dist/$name.png" || true
  done
}
trap cleanup EXIT
timeout --kill-after=20s 360s gradle :app:connectedDebugAndroidTest
timeout 30s adb install -r app/build/outputs/apk/debug/app-debug.apk
timeout 12s adb shell am force-stop com.osminog.vision
timeout 12s adb shell pm clear com.osminog.vision
timeout 12s adb shell rm -f /sdcard/vision-window.xml
timeout 20s adb shell am start -S -W -n com.osminog.vision/.MainActivity
ready=0
for attempt in $(seq 1 6); do
  timeout 12s adb shell uiautomator dump /sdcard/vision-window.xml >/dev/null 2>&1 || true
  if timeout 8s adb shell cat /sdcard/vision-window.xml 2>/dev/null | grep -q 'Меню OSMINOG'; then ready=1; break; fi
  sleep 1
done
timeout 12s adb shell screencap -p /sdcard/vision-clean-launch.png
timeout 12s adb pull /sdcard/vision-clean-launch.png dist/vision-clean-launch.png
test "$ready" -eq 1
