#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
cleanup() {
  timeout 12s adb logcat -d > dist/android-logcat.txt || true
  timeout 12s adb shell dumpsys activity activities > dist/activity-state.txt || true
  for name in vision-home vision-menu vision-menu-collapsed vision-menu-blue; do
    timeout 12s adb pull "/sdcard/$name.png" "dist/$name.png" || true
  done
}
trap cleanup EXIT
timeout --kill-after=20s 360s gradle :app:connectedDebugAndroidTest
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as E
files=list(Path('app/build/outputs/androidTest-results/connected').rglob('TEST-*.xml'))
assert files,'No instrumentation results'
n=0
for p in files:
 r=E.parse(p).getroot();n+=int(r.attrib['tests'])
 assert all(int(r.attrib.get(k,0))==0 for k in ('failures','errors','skipped')),p
assert n>=23,n
print('PERSONAL_MENU_TESTS_PASS',n)
PY
timeout 30s adb install -r app/build/outputs/apk/debug/app-debug.apk
timeout 12s adb shell am force-stop com.osminog.vision
timeout 12s adb shell pm clear com.osminog.vision
timeout 20s adb shell am start -S -W -n com.osminog.vision/.MainActivity
ready=0
for attempt in $(seq 1 4); do
  timeout 3s adb shell rm -f /sdcard/vision-window.xml || true
  if timeout 6s adb shell uiautomator dump /sdcard/vision-window.xml > "dist/cold-start-$attempt.log" 2>&1 && timeout 4s adb pull /sdcard/vision-window.xml "dist/cold-start-$attempt.xml" >> "dist/cold-start-$attempt.log" 2>&1; then
    state=$(python3 - "dist/cold-start-$attempt.xml" <<'PY'
import sys,xml.etree.ElementTree as E,re
try:
 nodes=list(E.parse(sys.argv[1]).getroot().iter('node'))
 text=' '.join(n.get('text','') for n in nodes)
 wait=next((n for n in nodes if n.get('resource-id')=='android:id/aerr_wait' and 'Quickstep' in text and 'OSMINOG' not in text),None)
 if wait:
  match=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',wait.get('bounds',''))
  if match:
   a,b,c,d=map(int,match.groups());print(f'WAIT {(a+c)//2} {(b+d)//2}');sys.exit()
 ready=any(n.get('package')=='com.osminog.vision' for n in nodes) and "isn't responding" not in text
 print('READY' if ready else 'PENDING')
except (OSError,E.ParseError):print('PENDING')
PY
)
    case "$state" in
      READY) ready=1; break ;;
      WAIT\ *) read -r _ x y <<< "$state"; timeout 8s adb shell input tap "$x" "$y"; sleep 1 ;;
    esac
  fi
  sleep 1
done
timeout 12s adb shell screencap -p /sdcard/vision-clean-launch.png
timeout 12s adb pull /sdcard/vision-clean-launch.png dist/vision-clean-launch.png
test "$ready" -eq 1
