#!/bin/bash
# Invoked inside the bounded own-user installation unit; no sudo or global pip.
set -euo pipefail
umask 077
test "$(id -un)" = osminog
release=${1:?source SHA required}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
target=/opt/osminog/mouse-search/releases/$release
test -d "$target" && test ! -L "$target"
pin=$(cat "$target/upstream-revision")
[[ "$pin" =~ ^[0-9a-f]{40}$ ]]
if test ! -d "$target/source/.git"; then
  git init -q "$target/source"
  git -C "$target/source" remote add origin https://github.com/searxng/searxng.git
fi
test "$(git -C "$target/source" remote get-url origin)" = https://github.com/searxng/searxng.git
git -C "$target/source" fetch -q --depth=1 origin "$pin"
git -C "$target/source" checkout -q --detach FETCH_HEAD
test "$(git -C "$target/source" rev-parse HEAD)" = "$pin"
python3 -m venv --without-pip "$target/venv"
"$target/venv/bin/python" "$target/bootstrap-pip.py" "$target"
"$target/venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir 'setuptools==80.9.0' wheel
"$target/venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir -r "$target/source/requirements.txt"
# Editable install retains pinned source/AGPL notices at the deployed revision.
SEARXNG_DISABLE_ETC_SETTINGS=true "$target/venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir --no-deps --no-build-isolation -e "$target/source"
"$target/venv/bin/python" -m pip freeze > "$target/dependencies.txt"
echo MOUSE_SEARCH_PINNED_INSTALL_PASS
