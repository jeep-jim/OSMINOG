#!/bin/bash
# Dedicated osminog account only. No root, nginx, firewall, DNS or foreign runtime.
set -euo pipefail
umask 077
test "$(id -un)" = osminog
test "$(id -u)" -ne 0
test "$(id -Gn)" = osminog
test "$(loginctl show-user osminog -p Linger --value)" = yes
release=${1:?source SHA required}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
base=/opt/osminog/mouse-search
target=$base/releases/$release
test -d "$target" && test ! -L "$base" && test ! -L "$target"
test "$(stat -c %U "$base")" = osminog
if ss -ltn '( sport = :3082 )' | tail -n +2 | grep -q .; then
  # An occupied unrelated port is a blocker, never something to stop or reuse.
  test -L "$base/current" && systemctl --user is-active --quiet osminog-mouse-search.service || { echo MOUSE_SEARCH_PORT_OCCUPIED; exit 1; }
fi
for item in secrets tls state state/searxng state/cache state/tmp; do
  test ! -L "$base/$item"
  mkdir -p "$base/$item"
  chmod 700 "$base/$item"
done
if test ! -s "$base/secrets/searxng-secret"; then openssl rand -hex 32 > "$base/secrets/searxng-secret"; fi
chmod 600 "$base/secrets/searxng-secret"
# Reuse the same own-domain certificate already trusted by the native product.
# Only the dedicated osminog account reads it. No key leaves this host.
test -f /opt/osminog/character/tls/server.crt && test -f /opt/osminog/character/tls/server.key
test "$(openssl x509 -in /opt/osminog/character/tls/server.crt -outform DER | sha256sum | cut -d' ' -f1)" = 18a7d7b3881078171848621de946b777ff682ba729ad6e4d399a1d6bff784d07
install -m 600 /opt/osminog/character/tls/server.crt "$base/tls/server.crt"
install -m 600 /opt/osminog/character/tls/server.key "$base/tls/server.key"
openssl x509 -in "$base/tls/server.crt" -checkend 2592000 -noout
systemd-run --user --quiet --wait --pipe --collect --unit="osminog-mouse-search-install-$release" \
  -p MemoryMax=512M -p MemorySwapMax=0 -p CPUQuota=25% -p TasksMax=64 -p NoNewPrivileges=yes \
  -p RuntimeMaxSec=600 -p LimitCORE=0 /bin/bash "$target/prepare.sh" "$release"
prior=$(readlink "$base/current" || true)
if test -n "$prior"; then [[ "$prior" =~ ^releases/[0-9a-f]{40}$ ]]; fi
mkdir -p "$HOME/.config/systemd/user"
install -m 600 "$target/osminog-mouse-search.service" "$HOME/.config/systemd/user/osminog-mouse-search.service"
ln -s "releases/$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
systemctl --user daemon-reload
systemctl --user enable osminog-mouse-search.service
systemctl --user restart osminog-mouse-search.service
if ! python3 - "$base/tls/server.crt" <<'PY'
import json,ssl,sys,time,urllib.request
ctx=ssl.create_default_context(cafile=sys.argv[1])
for _ in range(40):
    try:
        with urllib.request.urlopen('https://151.248.113.177:3082/health',context=ctx,timeout=2) as response:
            body=json.load(response)
        assert body['ok'] and body['service']=='osminog-mouse-search'
        print('MOUSE_SEARCH_LOCAL_TLS_HEALTH_PASS');break
    except Exception: time.sleep(.5)
else: raise SystemExit(1)
PY
then
  if test -n "$prior"; then
    ln -s "$prior" "$base/current.rollback"; mv -Tf "$base/current.rollback" "$base/current"
    systemctl --user restart osminog-mouse-search.service
  else systemctl --user stop osminog-mouse-search.service; fi
  echo MOUSE_SEARCH_START_FAILED
  exit 1
fi
group=$(systemctl --user show osminog-mouse-search.service -p ControlGroup --value)
test "$(cat "/sys/fs/cgroup$group/memory.max")" = 536870912
test "$(cat "/sys/fs/cgroup$group/cpu.max")" = '25000 100000'
test "$(cat "/sys/fs/cgroup$group/pids.max")" = 64
systemctl --user show osminog-mouse-search.service -p ActiveState -p MainPID -p MemoryCurrent -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax
echo MOUSE_SEARCH_DEDICATED_DEPLOY_PASS
