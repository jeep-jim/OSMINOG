#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
cleanup() {
  timeout 12s adb logcat -d > dist/android-logcat.txt || true
  timeout 12s adb shell dumpsys activity activities > dist/activity-state.txt || true
  for name in vision-home vision-menu vision-menu-collapsed vision-menu-blue vision-ocean vision-ocean-card vision-ocean-thread vision-attachments vision-language; do
    timeout 12s adb pull "/sdcard/$name.png" "dist/$name.png" || true
  done
}
trap cleanup EXIT
output_dir=$(realpath dist)
verifier_dir=$(realpath tools)
assert_cold_launch() {
  local label=$1 ready=0 local_xml remote_xml preserve=${2:-0} launcher_repaired=0
  remote_xml="/sdcard/vision-${label}.xml"
  timeout 12s adb shell am force-stop com.osminog.vision
  if [[ "$preserve" != 1 ]]; then timeout 12s adb shell pm clear com.osminog.vision; fi
  timeout 20s adb shell am start -S -W -n com.osminog.vision/.MainActivity
  for attempt in $(seq 1 6); do
    local_xml="$output_dir/vision-${label}-${attempt}.xml"
    timeout 8s adb shell rm -f "$remote_xml" || true
    # Consume the complete XML through adb pull. grep -q on an adb pipe can
    # close the stream early and turn a match into failure under pipefail.
    if timeout 12s adb shell uiautomator dump "$remote_xml" > "$output_dir/vision-${label}-${attempt}.log" 2>&1 &&
       timeout 8s adb pull "$remote_xml" "$local_xml" >> "$output_dir/vision-${label}-${attempt}.log" 2>&1 &&
       python3 - "$local_xml" <<'PY'
import sys, xml.etree.ElementTree as ET
try:
    root=ET.parse(sys.argv[1]).getroot()
    ready=any(n.get('package')=='com.osminog.vision' for n in root.iter('node')) and not any("isn't responding" in n.get('text','') for n in root.iter('node'))
except (OSError, ET.ParseError):
    ready=False
sys.exit(0 if ready else 1)
PY
    then ready=1; cp "$local_xml" "$output_dir/vision-${label}.xml"; break; fi
    if [[ "$launcher_repaired" == 0 && -s "$local_xml" ]]; then
      timeout 12s adb logcat -d > "$output_dir/launcher-recovery-logcat.txt"
      if python3 "$verifier_dir/recognize-quickstep-anr.py" "$local_xml" "$output_dir/launcher-recovery-logcat.txt" > "$output_dir/launcher-recovery-target.txt"; then
        cp "$local_xml" "$output_dir/launcher-recovery-dialog.xml"
        timeout 12s adb shell screencap -p /sdcard/launcher-recovery.png
        timeout 12s adb pull /sdcard/launcher-recovery.png "$output_dir/launcher-recovery.png"
        read -r tap_x tap_y < "$output_dir/launcher-recovery-target.txt"
        timeout 8s adb shell input tap "$tap_x" "$tap_y"
        launcher_repaired=1
        printf '%s\\n' 'Recovered one verified com.android.launcher3 ANR; OSMINOG startup must still pass.' | tee "$output_dir/launcher-recovery.txt"
        sleep 1
        timeout 20s adb shell am start -S -W -n com.osminog.vision/.MainActivity
      fi
    fi
    sleep 1
  done
  timeout 12s adb shell screencap -p "/sdcard/vision-${label}.png"
  timeout 12s adb pull "/sdcard/vision-${label}.png" "$output_dir/vision-${label}.png"
  if [[ "$ready" != 1 ]]; then
    echo "Android $label cold start did not expose the OSMINOG application window; inspect preserved UI XML/logs" >&2
    return 1
  fi
  echo "ANDROID_${label^^}_COLD_START_PASS"
}

# Ensure the test window is reachable before injecting real touch events.
# Recover only the independently identified Quickstep ANR using the same strict
# XML + log recognizer as signed cold-launch checks; never suppress OSMINOG ANR.
timeout 30s adb install -r app/build/outputs/apk/debug/app-debug.apk
assert_cold_launch instrumentation-bootstrap


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
assert n>=53,n
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
