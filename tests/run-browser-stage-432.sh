#!/usr/bin/env bash
set -euo pipefail
# Chromium's own window tests run under Xvfb + a real window manager.
# Xvfb alone cannot exercise minimize/activate behavior reliably.
openbox --sm-disable > /tmp/osminog-openbox-432.log 2>&1 &
wm=$!
trap 'kill "$wm" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$wm"
python3 tests/browser-stage-magnet-432.py
