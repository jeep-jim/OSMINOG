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
timeout 20s adb shell am start -S -W -n com.osminog.vision/.MainActivity
ready=0
for attempt in $(seq 1 18); do
  timeout 8s adb shell rm -f /sdcard/vision-window.xml || true
  if timeout 12s adb shell uiautomator dump /sdcard/vision-window.xml > "dist/cold-start-$attempt.log" 2>&1 &&
     timeout 8s adb pull /sdcard/vision-window.xml "dist/cold-start-$attempt.xml" >> "dist/cold-start-$attempt.log" 2>&1; then
    state=$(python3 - "dist/cold-start-$attempt.xml" <<'XML'
import sys,xml.etree.ElementTree as ET
try:
    root=ET.parse(sys.argv[1]).getroot()
    nodes=list(root.iter('node'))
    wait=next((n for n in nodes if n.get('resource-id')=='android:id/aerr_wait' and 'Quickstep' in ' '.join(x.get('text','') for x in nodes)),None)
    if wait:
        import re
        m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',wait.get('bounds',''))
        if m:
            a,b,c,d=map(int,m.groups());print(f'WAIT {(a+c)//2} {(b+d)//2}');sys.exit(0)
    ready=any(n.get('package')=='com.osminog.vision' for n in nodes) and not any("isn't responding" in n.get('text','') for n in nodes)
    print('READY' if ready else 'PENDING')
except (OSError,ET.ParseError):
    print('PENDING')
XML
)
    case "$state" in
      READY) ready=1; break ;;
      WAIT\ *)
        read -r _ x y <<< "$state"
        timeout 8s adb shell input tap "$x" "$y" || true
        sleep 2
        ;;
    esac
  fi
  sleep 1
done
timeout 12s adb shell screencap -p /sdcard/vision-clean-launch.png
timeout 12s adb pull /sdcard/vision-clean-launch.png dist/vision-clean-launch.png
test "$ready" -eq 1
