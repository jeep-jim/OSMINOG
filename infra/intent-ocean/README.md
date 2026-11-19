# REG pilot deployment — NOT executed by adding these files

Target from the existing AvtoCena operational configuration: REG VM 8120751,
151.248.113.177. Owner explicitly requested co-location. Current RAM, root-disk
headroom, CPU load and nginx ownership MUST be measured before installation.
The provided S3 screenshot (649.92 / 1000 GB) is not compute capacity.

Isolation: /opt/osminog, a separate SQLite database and container, loopback 3081,
nginx server_name osminog.red only. No AvtoCena source/config/data/container
changes, no reuse of its S3 data, no GPU or REG AI billing. Resource limits in
compose are configured ceilings, not measured consumption or capacity proof.
Do not run global Docker prune, restart nginx, remove images/volumes, change
server memory allocation or weaken existing service gates.

## Gated sequence

1. Run read-only host checks, confirm proposed paths/port are free, at least 2 GB
available memory and 10 GB free disk as conservative pilot gates; investigate
high sustained CPU. Recheck AvtoCena health before and after any later change.
2. Build tested Docker image in CI, never on the loaded shared host. Record
source and image digest, scan dependencies, transfer only the verified image.
3. Create /opt/osminog/data owned by 10001; install the separate compose config
with the pinned image. Start only its container. Verify localhost /healthz
with Host: osminog.red, registration invitation and a two-user exchange.
4. Back up any existing osminog-specific host file; never overwrite an unknown
vhost. Add the HTTP preparation host only, nginx -t, then reload (not restart)
nginx. Validate existing AvtoCena remains unchanged. No TLS private content yet.
5. Only now change REG DNS: keep ns1.reg.ru / ns2.reg.ru; A @ 151.248.113.177;
CNAME www osminog.red. Replace the previous Vercel targets. No A and CNAME
simultaneously on www. Preserve unrelated MX/TXT records; check stale AAAA.
6. Verify public DNS. Obtain a separate certificate for osminog.red and
www.osminog.red using webroot /opt/osminog/acme; do not use a plugin that edits
other nginx hosts. Install only this HTTPS vhost, test config, reload, verify
external HTTPS and both site health responses. Set up existing certificate
renewal with a tested nginx reload hook; do not assume it is configured.
7. Generate an invitation through the container's --invite CLI, deliver it
privately, never into Actions logs or repository. The pilot has no password
recovery and no automated moderation; establish an operator for stored reports.
8. Public opening and Android channel advancement are separate gates. Native
unsigned candidates are not installable owner upgrades. Verify retained
certificate, versionCode, legacy history preservation and two-device behavior.

## DNS source
REG instructions: https://help.reg.ru/support/dns-servery-i-nastroyka-zony/nastroyka-resursnykh-zapisey-dns/nastroyka-resursnykh-zapisey-v-lichnom-kabinete

Domain screenshot states expiration 2026-11-18, auto-renew off. Owner must renew;
this implementation does not purchase services or alter registration settings.

## Known constraints
This is a bounded invitation-only single-node pilot, not a public messaging
platform or an E2EE service. Readiness is not a security audit. Lexical matching,
5-second foreground conversation polling, 24-hour intents, at most 100 accounts,
20 active / 200 total intentions per user, 200 conversations / 500 messages each,
10 MB files per user / 512 MB total, 2 MB input per attachment. Images are decoded
and re-encoded without EXIF; PDF/TXT are download-only. Backups, restore drills,
account recovery, deletion workflow, moderated operations, social consent flow,
circles, semantic AI, push and production load acceptance remain release gates.
