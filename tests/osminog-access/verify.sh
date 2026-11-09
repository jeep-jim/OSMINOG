#!/usr/bin/env bash
# Disposable GitHub runner only. Never run these account fixtures on a real VM.
set -euo pipefail
umask 077
[[ ${GITHUB_ACTIONS:-} == true && $(id -u) == 0 ]] || { echo 'DISPOSABLE_GITHUB_RUNNER_REQUIRED' >&2; exit 1; }
script=$(mktemp /tmp/osminog-access-test.XXXXXX)
install -m 644 infra/osminog-access/bootstrap.sh "$script"
fixture=$(mktemp -d /tmp/osminog-fixture.XXXXXX)
ssh-keygen -q -t ed25519 -N '' -C test-only -f "$fixture/key"
chmod 600 "$fixture/key"
invoke(){ bash "$script" --public-key-file "$fixture/key.pub"; }
! getent passwd osminog >/dev/null
[[ ! -e /opt/osminog ]]
cleanup(){
 rm -f "$script"
 rm -rf "$fixture"
 if getent passwd osminog >/dev/null; then usermod -d /opt/osminog osminog || true; userdel -r osminog || true; fi
 [[ ! -e /opt/osminog ]] || rm -rf /opt/osminog
}
trap cleanup EXIT
if error=$(runuser -u nobody -- bash "$script" --public-key-file "$fixture/key.pub" 2>&1); then exit 1; fi
[[ "$error" == OSMINOG_SETUP_NEEDS_ROOT_CONSOLE ]]
mkdir /opt/osminog
if invoke; then exit 1; fi
! getent passwd osminog >/dev/null
rmdir /opt/osminog
invoke
[[ $(getent passwd osminog | cut -d: -f6) == /opt/osminog ]]
[[ $(stat -c %U:%a /opt/osminog/.ssh) == osminog:700 ]]
[[ ! -e /opt/osminog/.ssh/github_actions ]]
[[ $(stat -c %U:%a /opt/osminog/.ssh/authorized_keys) == osminog:600 ]]
grep -q '^restrict ssh-ed25519 ' /opt/osminog/.ssh/authorized_keys
before=$(sha256sum /opt/osminog/.ssh/authorized_keys)
invoke
[[ $(sha256sum /opt/osminog/.ssh/authorized_keys) == "$before" ]]
[[ $(wc -l < /opt/osminog/.ssh/authorized_keys) == 1 ]]
usermod -d /tmp/osminog-unexpected osminog
if invoke; then exit 1; fi
usermod -d /opt/osminog osminog
mv /opt/osminog/.ssh /opt/osminog/ssh-fixture
external=$(mktemp -d)
ln -s "$external" /opt/osminog/.ssh
if invoke; then exit 1; fi
[[ -z $(ls -A "$external") ]]
rm /opt/osminog/.ssh
mv /opt/osminog/ssh-fixture /opt/osminog/.ssh
rmdir "$external"
echo 'OSMINOG_ACCESS_TESTS_PASS: non-root, existing path, scoped account, idempotency, wrong home, symlink protection'
