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
private=$sshdir/github_actions
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
for path in "$sshdir" "$private" "$private.pub" "$sshdir/authorized_keys"; do
  [[ ! -L "$path" ]] || fail 'OSMINOG_SSH_PATH_IS_SYMLINK'
done
install -d -m 700 -o "$account" -g "$account" "$sshdir"
if [[ ! -e "$private" ]]; then
  [[ ! -e "$private.pub" ]] || fail 'OSMINOG_PUBLIC_KEY_EXISTS_WITHOUT_PRIVATE'
  runuser -u "$account" -- sh -c 'umask 077; exec ssh-keygen -q -t ed25519 -N "" -C osminog-actions -f "$1"' sh "$private"
fi
[[ -f "$private" && -f "$private.pub" ]] || fail 'OSMINOG_KEY_PAIR_INCOMPLETE'
chown "$account:$account" "$private" "$private.pub"
chmod 600 "$private"
chmod 644 "$private.pub"
# Check the pair without printing private material or changing an existing key.
public_from_private=$(runuser -u "$account" -- ssh-keygen -y -P '' -f "$private")
read -r algorithm public_value _ < "$private.pub"
read -r derived_algorithm derived_value _ <<< "$public_from_private"
[[ "$derived_algorithm $derived_value" == "$algorithm $public_value" && $algorithm == ssh-ed25519 ]] || fail 'OSMINOG_KEY_PAIR_INVALID'
authorized=$sshdir/authorized_keys
touch "$authorized"
if ! grep -Fq "$algorithm $public_value" "$authorized"; then
  printf 'restrict %s %s osminog-actions\n' "$algorithm" "$public_value" >> "$authorized"
fi
chown "$account:$account" "$private" "$private.pub" "$authorized"
chmod 600 "$private" "$authorized"
chmod 644 "$private.pub"
printf '%s\n' 'OSMINOG_ACCESS_CREATED' 'User: osminog' 'Path: /opt/osminog' 'SSH private key file: /opt/osminog/.ssh/github_actions'
ssh-keygen -lf "$private.pub"
