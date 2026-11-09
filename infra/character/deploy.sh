#!/bin/bash
# Runs exclusively as the dedicated osminog user. Never sudo, Docker, nginx or DNS.
set -euo pipefail
umask 077
test "$(id -un)" = osminog
test "$(id -u)" -ne 0
test "$(id -Gn)" = osminog
test "$(loginctl show-user osminog -p Linger --value)" = yes
release=${1:?source SHA required}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
base=/opt/osminog/character
test -d "$base/releases/$release"
test -s "$base/secrets/reg-api-key"
test ! -L "$base"
mkdir -p "$base/tls" "$base/state" "$HOME/.config/systemd/user"
chmod 700 "$base" "$base/tls" "$base/state" "$base/secrets"
if test ! -e "$base/tls/server.key" && test ! -e "$base/tls/server.crt"; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -days 730 \
    -keyout "$base/tls/server.key" -out "$base/tls/server.crt" \
    -subj '/CN=osminog.red' -addext 'subjectAltName=DNS:osminog.red,IP:151.248.113.177' \
    -addext 'keyUsage=digitalSignature' -addext 'extendedKeyUsage=serverAuth' >/dev/null 2>&1
fi
test -f "$base/tls/server.key" && test -f "$base/tls/server.crt"
chmod 600 "$base/tls/"*
openssl x509 -in "$base/tls/server.crt" -checkend 2592000 -noout
prior=$(readlink "$base/current" || true)
if test ! -e "$base/current" && ss -ltn '( sport = :3081 )' | tail -n +2 | grep -q .; then
  echo 'OSMINOG_PORT_OCCUPIED'; exit 1
fi
install -m 600 "$base/releases/$release/osminog-character.service" "$HOME/.config/systemd/user/osminog-character.service"
ln -s "releases/$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
systemctl --user daemon-reload
systemctl --user enable osminog-character.service
systemctl --user restart osminog-character.service
if ! python3 - "$base/tls/server.crt" <<'PY'
import json,ssl,sys,time,urllib.request
ctx=ssl.create_default_context(cafile=sys.argv[1])
for _ in range(20):
    try:
        with urllib.request.urlopen('https://151.248.113.177:3081/health',context=ctx,timeout=2) as r:
            body=json.load(r)
        assert body['ok'] and body['service']=='osminog-character'
        print('OSMINOG_LOCAL_TLS_HEALTH_PASS'); break
    except Exception: time.sleep(.5)
else: raise SystemExit(1)
PY
then
  if test -n "$prior"; then ln -s "$prior" "$base/current.rollback"; mv -Tf "$base/current.rollback" "$base/current"; systemctl --user restart osminog-character.service;
  else systemctl --user stop osminog-character.service; fi
  echo OSMINOG_START_FAILED; exit 1
fi
group=$(systemctl --user show osminog-character.service -p ControlGroup --value)
test "$(cat "/sys/fs/cgroup$group/memory.max")" = 268435456
test "$(cat "/sys/fs/cgroup$group/cpu.max")" = '25000 100000'
test "$(cat "/sys/fs/cgroup$group/pids.max")" = 32
systemctl --user show osminog-character.service -p ActiveState -p MainPID -p MemoryCurrent -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax
echo OSMINOG_DEDICATED_SERVICE_PASS
# Public certificate only; private key and API secret are never printed.
cat "$base/tls/server.crt"
