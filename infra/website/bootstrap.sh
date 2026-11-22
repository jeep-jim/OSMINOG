#!/usr/bin/env bash
# One-time owner/admin setup for mouse.black. Routine content deploys use osminog.
# Run only after checking this file's SHA-256 against the recorded workflow output.
set -euo pipefail
umask 022
fail() { printf 'MOUSE_SETUP_ERROR: %s\n' "$*" >&2; exit 1; }
[[ $(id -u) == 0 ]] || fail 'Run this reviewed installer in the server administrator console.'
[[ $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] || fail 'Usage: bootstrap.sh <verified-source-commit>'
release=$1
source_dir=/opt/osminog/website/releases/$release
public_dir=/var/www/mouse.black
nginx_file=/etc/nginx/conf.d/mouse.black.conf
challenge_dir=/var/lib/mouse-website/acme
cert_config=/etc/letsencrypt-mouse
cert_work=/var/lib/letsencrypt-mouse
cert_logs=/var/log/letsencrypt-mouse
marker='# Managed by OSMINOG: mouse.black website'
for command in python3 nginx certbot systemctl install sha256sum curl runuser; do
  command -v "$command" >/dev/null || fail "Required existing program is missing: $command"
done
[[ $(id -u osminog) != 0 && $(id -gn osminog) == osminog ]] || fail 'Dedicated osminog account not found.'
[[ -d /etc/nginx/conf.d && ! -L /etc/nginx/conf.d ]] || fail 'Unexpected Nginx config directory.'
[[ ! -L "$nginx_file" ]] || fail 'Refusing a symlink for the Mouse virtual host.'
if [[ -e "$nginx_file" ]] && ! head -1 "$nginx_file" | grep -Fxq "$marker"; then
  fail 'An unrecognized mouse.black.conf already exists; review it before installing.'
fi
for path in /var/www "$public_dir" "$public_dir/releases" "$cert_config" "$cert_work" "$cert_logs" /var/lib/mouse-website "$challenge_dir"; do
  [[ ! -L "$path" ]] || fail "Refusing unexpected symlink: $path"
done
nginx -t
temp_dir=$(mktemp -d /root/mouse-website-setup.XXXXXX)
trap 'rm -rf -- "$temp_dir"' EXIT

# Copy into a root-owned snapshot and verify every byte before any public switch.
# Only static website files are accepted; none of the staged files are executed.
python3 - "$source_dir" "$release" "$temp_dir/site" <<'PY'
import hashlib, json, os, re, shutil, stat, sys
from pathlib import Path
source, commit, output = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
if source.resolve() != source or not source.is_dir():
    raise SystemExit("Unexpected staged release path")
manifest = source / "SHA256SUMS"
if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size > 65536:
    raise SystemExit("Missing or invalid staged manifest")
entries = {}
for line in manifest.read_text().splitlines():
    match = re.fullmatch(r"([0-9a-f]{64})  ([a-zA-Z0-9][a-zA-Z0-9._/-]*)", line)
    if not match:
        raise SystemExit("Invalid manifest entry")
    digest, name = match.groups()
    if name in entries or name.startswith("/") or any(p in ("", ".", "..") for p in name.split("/")):
        raise SystemExit("Invalid or duplicate path")
    if Path(name).suffix.lower() not in {".html", ".css", ".js", ".mjs", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".json", ".xml", ".txt", ".webmanifest"}:
        raise SystemExit("Unexpected file type")
    entries[name] = digest
if not {"index.html", "release.json"} <= entries.keys() or not 2 <= len(entries) <= 200:
    raise SystemExit("Incomplete website manifest")
actual = set()
total = 0
for root, dirs, files in os.walk(source, followlinks=False):
    for name in dirs + files:
        path = Path(root) / name
        if path.is_symlink():
            raise SystemExit("Links are not permitted in a website release")
    for name in files:
        path = Path(root) / name
        mode = path.stat().st_mode
        if not stat.S_ISREG(mode) or mode & 0o111 or path.stat().st_size > 10 * 1024 * 1024:
            raise SystemExit("Unexpected file mode or size")
        actual.add(path.relative_to(source).as_posix())
if actual != set(entries) | {"SHA256SUMS"}:
    raise SystemExit("Unlisted or missing staged files")
output.mkdir(mode=0o755)
for name, expected in entries.items():
    data = (source / name).read_bytes()
    total += len(data)
    if total > 25 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit("Website checksum mismatch")
    if Path(name).suffix.lower() in {".html", ".css", ".js", ".mjs", ".svg", ".txt", ".json", ".xml", ".webmanifest"}:
        if b"github.com" in data.lower() or b"githubusercontent.com" in data.lower():
            raise SystemExit("Public website must not expose repository URLs")
    destination = output / name
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
    destination.write_bytes(data)
    destination.chmod(0o644)
metadata = json.loads((output / "release.json").read_text())
expected_marker = {"release": hashlib.sha256(("mouse.black/site/" + commit).encode()).hexdigest(), "domain": "mouse.black"}
if metadata != expected_marker:
    raise SystemExit("Release identity mismatch")
shutil.copyfile(manifest, output / "SHA256SUMS")
(output / "SHA256SUMS").chmod(0o644)
PY

# Only this domain's dedicated webroot is managed. The project home stays private.
if [[ ! -e /var/www ]]; then install -d -m 755 /var/www; fi
[[ -d /var/www ]] || fail 'The existing public parent is not a directory.'
if [[ -e "$public_dir" ]]; then
  [[ -d "$public_dir" && $(stat -c %U "$public_dir") == osminog ]] || fail 'Unexpected existing Mouse webroot ownership.'
else
  install -d -m 755 -o osminog -g osminog "$public_dir"
fi
install -d -m 755 -o osminog -g osminog "$public_dir/releases"
[[ ! -L "$public_dir/downloads" ]] || fail 'Unexpected public downloads symlink.'
install -d -m 755 -o osminog -g osminog "$public_dir/downloads"
# Copy actual verified installers. No redirect or upstream URL is served to visitors.
python3 - /opt/osminog/website/downloads "$public_dir/downloads" <<'PY'
import hashlib, json, os, pwd, re, shutil, stat, sys, tempfile
from pathlib import Path
source, output = Path(sys.argv[1]), Path(sys.argv[2])
if source.resolve() != source or output.resolve() != output:
    raise SystemExit("Unexpected downloads path")
manifest = source / "manifest.json"
if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size > 65536:
    raise SystemExit("Verified download manifest has not been staged")
metadata = json.loads(manifest.read_text())
files = metadata.get("files", [])
version = metadata.get("version", "")
if not re.fullmatch(r"\d+\.\d+\.\d+", version) or len(files) != 3:
    raise SystemExit("Invalid installer manifest")
suffixes = {"mac-arm64.dmg", "Windows-x64.exe", "Linux-x64.AppImage"}
expected_names = {"Mouse-Browser-" + version + "-" + suffix for suffix in suffixes}
if {item.get("filename") for item in files} != expected_names:
    raise SystemExit("Unexpected platform filenames")
reserve = 500 * 1024 * 1024
for item in files:
    name, digest, size = item["filename"], item.get("sha256", ""), item.get("size")
    if not re.fullmatch(r"[0-9a-f]{64}", digest) or not isinstance(size, int) or not 0 < size <= 500 * 1024 * 1024:
        raise SystemExit("Invalid installer hash or size")
    path = source / name
    if path.is_symlink() or not path.is_file() or path.stat().st_size != size or path.stat().st_mode & 0o111:
        raise SystemExit("Missing or unexpected installer file: " + name)
    target = output / name
    if target.is_symlink() or (target.exists() and not target.is_file()):
        raise SystemExit("Unsafe installer destination")
    if target.exists():
        existing_hash = hashlib.sha256()
        with target.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""): existing_hash.update(chunk)
        if target.stat().st_size == size and existing_hash.hexdigest() == digest:
            print("MOUSE_INSTALLER_ALREADY_VERIFIED " + name)
            continue
        raise SystemExit("An immutable public installer already exists with different bytes")
    if shutil.disk_usage(output).free < size + reserve:
        raise SystemExit("Insufficient free disk with 500 MiB reserve")
    fd, temporary = tempfile.mkstemp(prefix=".installer-", dir=output)
    try:
        calculated = hashlib.sha256()
        copied = 0
        with path.open("rb") as incoming, os.fdopen(fd, "wb") as outgoing:
            for chunk in iter(lambda: incoming.read(1024 * 1024), b""):
                copied += len(chunk)
                if copied > size: raise SystemExit("Installer changed during transfer")
                calculated.update(chunk)
                outgoing.write(chunk)
            outgoing.flush()
            os.fsync(outgoing.fileno())
        if copied != size or calculated.hexdigest() != digest:
            raise SystemExit("Installer checksum mismatch")
        account = pwd.getpwnam("osminog")
        os.chmod(temporary, 0o644)
        os.chown(temporary, account.pw_uid, account.pw_gid)
        os.replace(temporary, target)
        print("MOUSE_INSTALLER_VERIFIED " + name)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)
PY
if [[ -e "$public_dir/releases/$release" ]]; then
  [[ ! -L "$public_dir/releases/$release" ]] || fail 'Unexpected release symlink.'
  diff -qr "$temp_dir/site" "$public_dir/releases/$release" >/dev/null || fail 'Existing release bytes differ.'
else
  install -d -m 755 "$public_dir/releases/$release"
  cp -a "$temp_dir/site/." "$public_dir/releases/$release/"
  chown -R osminog:osminog "$public_dir/releases/$release"
fi
[[ ! -e "$public_dir/current" || -L "$public_dir/current" ]] || fail 'Mouse current must be a release symlink.'
temporary_link=$public_dir/current.setup.$$
[[ ! -e "$temporary_link" && ! -L "$temporary_link" ]] || fail 'Temporary publication path already exists.'
runuser -u osminog -- ln -sT "releases/$release" "$temporary_link"
runuser -u osminog -- mv -Tf "$temporary_link" "$public_dir/current"
install -d -m 755 /var/lib/mouse-website "$challenge_dir" "$challenge_dir/.well-known" "$challenge_dir/.well-known/acme-challenge"

write_http() {
  cat <<'NGINX'
# Managed by OSMINOG: mouse.black website
server {
    listen 80;
    server_name mouse.black www.mouse.black;
    root /var/www/mouse.black/current;
    index index.html;
    access_log off;
    error_log /var/log/nginx/mouse.black.error.log warn;
    location ^~ /.well-known/acme-challenge/ { root /var/lib/mouse-website/acme; default_type text/plain; }
    location ~ ^/downloads/(Mouse-Browser-[0-9.]+-(mac-arm64\.dmg|Windows-x64\.exe|Linux-x64\.AppImage))$ {
        alias /var/www/mouse.black/downloads/$1;
        autoindex off;
        default_type application/octet-stream;
        add_header Content-Disposition attachment always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options nosniff always;
    }
    location = /SHA256SUMS { return 404; }
    location / { try_files $uri $uri/ =404; }
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
}
NGINX
}
write_https() {
  cat <<'NGINX'
# Managed by OSMINOG: mouse.black website
server {
    listen 80;
    server_name mouse.black www.mouse.black;
    access_log off;
    location ^~ /.well-known/acme-challenge/ { root /var/lib/mouse-website/acme; default_type text/plain; }
    location / { return 301 https://mouse.black$request_uri; }
}
server {
    listen 443 ssl;
    server_name www.mouse.black;
    ssl_certificate /etc/letsencrypt-mouse/live/mouse.black/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt-mouse/live/mouse.black/privkey.pem;
    access_log off;
    return 301 https://mouse.black$request_uri;
}
server {
    listen 443 ssl;
    server_name mouse.black;
    ssl_certificate /etc/letsencrypt-mouse/live/mouse.black/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt-mouse/live/mouse.black/privkey.pem;
    root /var/www/mouse.black/current;
    index index.html;
    access_log off;
    error_log /var/log/nginx/mouse.black.error.log warn;
    location ~ ^/downloads/(Mouse-Browser-[0-9.]+-(mac-arm64\.dmg|Windows-x64\.exe|Linux-x64\.AppImage))$ {
        alias /var/www/mouse.black/downloads/$1;
        autoindex off;
        default_type application/octet-stream;
        add_header Content-Disposition attachment always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options nosniff always;
    }
    location = /SHA256SUMS { return 404; }
    location / { try_files $uri $uri/ =404; }
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
}
NGINX
}
apply_config() {
  local had_previous=no
  if [[ -f "$nginx_file" ]]; then cp -p "$nginx_file" "$temp_dir/previous.conf"; had_previous=yes; fi
  install -m 644 "$temp_dir/candidate.conf" "$nginx_file"
  if ! nginx -t || ! systemctl reload nginx; then
    if [[ $had_previous == yes ]]; then install -m 644 "$temp_dir/previous.conf" "$nginx_file"; else rm -f "$nginx_file"; fi
    nginx -t && systemctl reload nginx || true
    fail 'Mouse config failed validation; its previous config was restored.'
  fi
}
has_existing_cert=no
if [[ -f "$cert_config/live/mouse.black/fullchain.pem" && -f "$cert_config/live/mouse.black/privkey.pem" ]]; then
  has_existing_cert=yes
  write_https > "$temp_dir/candidate.conf"
else
  write_http > "$temp_dir/candidate.conf"
fi
apply_config
if [[ $has_existing_cert == no ]]; then
curl --fail --location --silent --show-error --max-time 15 --noproxy '*' \
    --resolve mouse.black:80:127.0.0.1 --resolve mouse.black:443:127.0.0.1 \
    http://mouse.black/release.json > "$temp_dir/served-release.json"
python3 - "$temp_dir/served-release.json" "$release" <<'PY'
import hashlib, json, sys
expected_marker = {"release": hashlib.sha256(("mouse.black/site/" + sys.argv[2]).encode()).hexdigest(), "domain": "mouse.black"}
assert json.load(open(sys.argv[1])) == expected_marker, "Wrong Mouse release served"
PY
fi

# A separate ACME account/config isolates this certificate from other projects.
# Webroot validation keeps the existing Nginx process serving throughout.
if ! certbot certonly --webroot --webroot-path "$challenge_dir" \
    --config-dir "$cert_config" --work-dir "$cert_work" --logs-dir "$cert_logs" \
    --cert-name mouse.black -d mouse.black -d www.mouse.black \
    --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring; then
  fail 'The Mouse HTTP site is installed, but certificate issuance failed. Check public DNS for both names and rerun this same installer.'
fi
write_https > "$temp_dir/candidate.conf"
apply_config

[[ ! -L /usr/local/libexec ]] || fail 'Unexpected certificate hook parent symlink.'
if [[ ! -e /usr/local/libexec ]]; then install -d -m 755 /usr/local/libexec; fi
[[ -d /usr/local/libexec ]] || fail 'The existing certificate hook parent is not a directory.'
cat > /usr/local/libexec/mouse-website-cert-renewed <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
nginx -t
systemctl reload nginx
HOOK
chmod 755 /usr/local/libexec/mouse-website-cert-renewed
certbot_bin=$(command -v certbot)
cat > /etc/systemd/system/mouse-website-cert-renew.service <<UNIT
[Unit]
Description=Renew only the mouse.black website certificate
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=$certbot_bin renew --config-dir /etc/letsencrypt-mouse --work-dir /var/lib/letsencrypt-mouse --logs-dir /var/log/letsencrypt-mouse --cert-name mouse.black --quiet --deploy-hook /usr/local/libexec/mouse-website-cert-renewed
UNIT
cat > /etc/systemd/system/mouse-website-cert-renew.timer <<'UNIT'
[Unit]
Description=Check mouse.black certificate twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now mouse-website-cert-renew.timer
curl --fail --silent --show-error --max-time 15 --resolve mouse.black:443:127.0.0.1 https://mouse.black/release.json > "$temp_dir/https-release.json"
python3 - "$temp_dir/https-release.json" "$release" <<'PY'
import hashlib, json, sys
expected_marker = {"release": hashlib.sha256(("mouse.black/site/" + sys.argv[2]).encode()).hexdigest(), "domain": "mouse.black"}
assert json.load(open(sys.argv[1])) == expected_marker, "Wrong HTTPS release served"
PY
printf '\nMOUSE_WEBSITE_LIVE https://mouse.black\nRelease: %s\nCertificate renewal: mouse-website-cert-renew.timer\n' "$release"
