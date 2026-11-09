#!/usr/bin/env bash
# Disposable GitHub runner only. Never run these account fixtures on a real VM.
set -euo pipefail
[[ ${GITHUB_ACTIONS:-} == true && $(id -u) == 0 ]] || { echo 'DISPOSABLE_GITHUB_RUNNER_REQUIRED' >&2; exit 1; }
script=$(mktemp /tmp/osminog-access-test.XXXXXX)
install -m 644 infra/osminog-access/bootstrap.sh "$script"
! getent passwd osminog >/dev/null
[[ ! -e /opt/osminog ]]
cleanup(){
 rm -f "$script"
 if getent passwd osminog >/dev/null; then usermod -d /opt/osminog osminog || true; userdel -r osminog || true; fi
 [[ ! -e /opt/osminog ]] || rm -rf /opt/osminog
}
trap cleanup EXIT
if error=$(runuser -u nobody -- bash "$script" 2>&1); then exit 1; fi
[[ "$error" == OSMINOG_SETUP_NEEDS_ROOT_CONSOLE ]]
mkdir /opt/osminog
if bash "$script"; then exit 1; fi
! getent passwd osminog >/dev/null
rmdir /opt/osminog
bash "$script"
[[ $(getent passwd osminog | cut -d: -f6) == /opt/osminog ]]
[[ $(stat -c %U:%a /opt/osminog/.ssh) == osminog:700 ]]
[[ $(stat -c %U:%a /opt/osminog/.ssh/github_actions) == osminog:600 ]]
[[ $(stat -c %U:%a /opt/osminog/.ssh/authorized_keys) == osminog:600 ]]
grep -q '^restrict ssh-ed25519 ' /opt/osminog/.ssh/authorized_keys
before=$(sha256sum /opt/osminog/.ssh/github_actions)
bash "$script"
[[ $(sha256sum /opt/osminog/.ssh/github_actions) == "$before" ]]
[[ $(wc -l < /opt/osminog/.ssh/authorized_keys) == 1 ]]
usermod -d /tmp/osminog-unexpected osminog
if bash "$script"; then exit 1; fi
usermod -d /opt/osminog osminog
mv /opt/osminog/.ssh /opt/osminog/ssh-fixture
external=$(mktemp -d)
ln -s "$external" /opt/osminog/.ssh
if bash "$script"; then exit 1; fi
[[ -z $(ls -A "$external") ]]
rm /opt/osminog/.ssh
mv /opt/osminog/ssh-fixture /opt/osminog/.ssh
rmdir "$external"
echo 'OSMINOG_ACCESS_TESTS_PASS: non-root, existing path, scoped account, idempotency, wrong home, symlink protection'
