#!/usr/bin/env bash
# Run once by the owner in the REG console. Only OSMINOG account/path are changed.
set -euo pipefail
umask 077
fail(){ printf '%s\n' "$1" >&2; exit 1; }
[[ $(id -u) == 0 ]] || fail 'OSMINOG_SETUP_NEEDS_ROOT_CONSOLE'
for program in getent useradd runuser ssh-keygen install stat grep; do command -v "$program" >/dev/null || fail "OSMINOG_SETUP_MISSING_$program"; done
app=/opt/osminog
account=osminog
sshdir=$app/.ssh
public_key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHmOeVQS8c1oEyigVCkV/H8RHpLouXU004FZMP00XBZV osminog-actions'
if [[ $# -gt 0 ]]; then
  [[ $# == 2 && $1 == --public-key-file && -f $2 ]] || fail 'OSMINOG_PUBLIC_KEY_ARGUMENT_INVALID'
  public_key=$(cat "$2")
fi
[[ "$public_key" != *$'\n'* ]] || fail 'OSMINOG_PUBLIC_KEY_MULTILINE'
read -r algorithm public_value _ <<< "$public_key"
[[ $algorithm == ssh-ed25519 && $public_value =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || fail 'OSMINOG_PUBLIC_KEY_FORMAT_INVALID'
public_temp=$(mktemp /tmp/osminog-public.XXXXXX)
trap 'rm -f "$public_temp"' EXIT
printf '%s %s osminog-actions\n' "$algorithm" "$public_value" > "$public_temp"
ssh-keygen -lf "$public_temp" >/dev/null || fail 'OSMINOG_PUBLIC_KEY_INVALID'
[[ ! -L "$app" ]] || fail 'OSMINOG_PATH_IS_SYMLINK'
if getent passwd "$account" >/dev/null; then
  record=$(getent passwd "$account")
  IFS=: read -r _ _ account_uid account_gid _ account_home account_shell <<< "$record"
  [[ $account_uid -ne 0 && $account_home == "$app" && $account_shell == /bin/bash ]] || fail 'OSMINOG_EXISTING_ACCOUNT_REQUIRES_REVIEW'
  [[ $(id -gn "$account") == "$account" && $(id -nG "$account") == "$account" ]] || fail 'OSMINOG_ACCOUNT_HAS_UNEXPECTED_GROUPS'
  [[ -d "$app" && $(stat -c %U "$app") == "$account" ]] || fail 'OSMINOG_EXISTING_PATH_REQUIRES_REVIEW'
else
  [[ ! -e "$app" ]] || fail 'OSMINOG_PATH_EXISTS_WITHOUT_ACCOUNT'
  useradd --create-home --home-dir "$app" --shell /bin/bash --user-group "$account"
fi
for path in "$sshdir" "$sshdir/authorized_keys"; do
  [[ ! -L "$path" ]] || fail 'OSMINOG_SSH_PATH_IS_SYMLINK'
done
[[ ! -e "$sshdir/authorized_keys" || -f "$sshdir/authorized_keys" ]] || fail 'OSMINOG_AUTHORIZED_KEYS_NOT_FILE'
install -d -m 700 -o "$account" -g "$account" "$sshdir"
authorized=$sshdir/authorized_keys
touch "$authorized"
if ! grep -Fq "$algorithm $public_value" "$authorized"; then
  printf 'restrict %s %s osminog-actions\n' "$algorithm" "$public_value" >> "$authorized"
fi
chown "$account:$account" "$authorized"
chmod 600 "$authorized"
printf '%s\n' 'OSMINOG_ACCESS_CREATED' 'User: osminog' 'Path: /opt/osminog'
ssh-keygen -lf "$public_temp"
