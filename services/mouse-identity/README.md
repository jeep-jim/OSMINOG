# Mouse ID service — 6.0.45

Dedicated Mouse service; Node **22.13 or newer**, no npm runtime dependencies.
Run as the restricted `osminog` user. It does not proxy files, run the Flash
signaling broker, send mail, or change other applications on the shared VM.

## Runtime and storage

Package these paths with their relative layout intact:

- `services/mouse-identity/*.cjs`
- `desktop/mouse-account-proof.cjs`
- `desktop/mouse-flash-identity.cjs`
- `desktop/mouse-sync-schema.cjs`
- `desktop/mouse/layout.js` and `desktop/mouse/appearance.js`

Set `MOUSE_ID_DATA_DIR` to an absolute, canonical, dedicated directory outside
the checkout. First run `node services/mouse-identity/main.cjs --init` as
`osminog`. It creates `issuer-ed25519.pem`, `owner-bootstrap.txt` (both 0600),
and `accounts.sqlite` in a 0700 directory. Standard output contains **only public
issuer information**. Pin `serverPublicKey` in the application configuration;
`GET /v1/accounts/info` must never replace a pin automatically. Back up the
private issuer together with a consistent SQLite backup. Do not copy only the
main database while a running writer has an uncheckpointed WAL. A stopped
service can be backed up as a complete private data directory.

The owner bootstrap is a random 256-bit capability. Deliver it privately to the
owner, never in source, CI output, a URL, a public artifact, or a chat report.
Owner registration atomically consumes its database hash and binds ID **1**.
Other registrations start at **2**. After a successful owner claim the obsolete
bootstrap file may be removed; restart does not require it after consumption.
There is no client flag that assigns ID 1.

Start the same command without `--init` to serve. Options:

| Environment variable | Default / meaning |
| --- | --- |
| `MOUSE_ID_DATA_DIR` | Required private canonical directory |
| `MOUSE_ID_HOST` | `127.0.0.1`; a nonloopback bind requires direct TLS |
| `MOUSE_ID_PORT` | `8788` |
| `MOUSE_ID_TRUST_LOOPBACK_PROXY` | Set `1` only behind the local HTTPS proxy |
| `MOUSE_ID_TLS_CERT`, `MOUSE_ID_TLS_KEY` | Optional absolute paths for direct TLS; key must be private and owned by this user |
| `MOUSE_ID_MAX_ACCOUNTS` | `4096`, including the reserved owner row |

Production HTTP behind a trusted local proxy requires **all** of:

- Actual socket peer is loopback.
- Proxy overwrites `X-Forwarded-Proto` with `https`.
- Proxy overwrites `X-Real-IP` with one actual client IP.
- `X-Forwarded-For` is absent or exactly that same single IP, never a chain.

Other forwarded-header configurations are rejected. Direct non-TLS API access
is rejected. The loopback `GET /health` remains available for supervision.
No browser origins are allowed by default: the native main process makes
requests without `Origin`, cookies or renderer-held bearer tokens.

There are no request/body/token/password logs. Failures expose fixed codes, not
SQL errors, file paths, exception stacks or input values. Supervision should
restart this service independently of the Flash broker. Public proxy/TLS
configuration and its administrative permissions are a separate deployment
step; writing this service does not prove that routing is live.

## Account protocol

All application routes have prefix `/v1/accounts`. Authentication uses
`Authorization: Bearer <accessToken>` from native code.

`POST /challenge` accepts `{action,identity,encryptionKey,accountId? ,profile?,
registrationId?}`. `identity` is the existing `{deviceId,name,publicKey}`
Ed25519 identity. `encryptionKey` is separate canonical X25519 SPKI base64.
Registration actions require `profile:{name,avatarHash}` and a random 43-character
base64url `registrationId`; the native client keeps that ID until registration
and recovery-code acknowledgement finish. Other actions require `accountId`.

The response is a strict v2 challenge containing action, account, registration
ID, profile, both keys, issuer, registry, nonce and deadline. The device signs
`authChallengeTranscript(challenge)` with the existing device signer. Every
completion consumes its five-minute challenge, including unsuccessful attempts.

| Endpoint | Body / result |
| --- | --- |
| `POST /register` | `{challengeId,signature,password,avatar}` → session and one-time `recoveryCode` |
| `POST /claim-owner` | Same, with `ownerBootstrapSecret` on first claim |
| `POST /login` | `{challengeId,signature,password}` → session |
| `POST /recover` | `{challengeId,signature,recoveryCode,newPassword}` → session and rotated recovery code; revokes all previous devices/sessions |
| `POST /refresh` | `{challengeId,signature,refreshToken}`; challenge action is `refresh` |
| `GET /me` | Current account and refreshed certificate |
| `PUT /profile` | `{name,avatar}` → account and refreshed certificate |
| `GET /devices` | Current account's active devices |
| `DELETE /devices/:deviceId` | Revokes that device's sessions and mailbox presence |
| `POST /password` | `{password,newPassword}` → replacement session; revokes other sessions |
| `POST /recovery-code` | `{password}` → new recovery code; invalidates previous one |
| `POST /logout` | `{}` → revokes this session and mailbox presence |

Session response: `{account:{id,name,avatar},certificate,accessToken,
refreshToken,accessExpiresAt,refreshExpiresAt,recoveryCode?}`. Avatars are native
PNG thumbnails up to 256×256 and 512 KiB. Their actual bytes' SHA-256 is signed;
non-image metadata, invalid CRCs and trailing payload are rejected.

A repeated registration with a fresh challenge, the same `registrationId`,
device key, profile and password returns **the same account** and rotates its
session/recovery code. No plaintext response or recovery-code cache exists. A
simultaneous in-flight duplicate may return `REGISTRATION_RETRY` (409); retry
with a fresh challenge and unchanged registration ID and credentials.

Passwords use NFC Unicode, 15–128 code points, a small obvious-password
blocklist and async scrypt N=32768, r=8, p=3. There is one active hash and at most
eight queued hashes per process, plus IP/account attempt limits. Access tokens
last ten minutes. Refresh tokens last thirty days from the original login;
rotation does not extend that family deadline. Refresh proof is bound to the
device. Both tokens rotate, hashes alone are stored, and replay of an old refresh
token with the matching device proof revokes that family. A lost refresh
response can require password login again; it does not delete workspace data.

Recovery codes are 256-bit random, one-use and rotated after use. There is no
weak secret question and no claim of email recovery without a configured,
verified mail transport. Native code stores an unacknowledged recovery code
only inside OS/Keychain-protected session data, erases it on acknowledgement,
and clears local login material on logout even when the network is unavailable.

V2 certificates bind account ID, Ed25519 and X25519 device keys, name and avatar
hash. They last 24 hours; the shared verifier still accepts the older v1 format.
Server session/device revocation is immediate for online account endpoints.
An already issued offline-verifiable certificate remains valid until its expiry;
it is not a claim of human identity or an online revocation check.

## Lightweight settings only

`GET /sync/revision` returns only `{revision,updatedAt}` from a narrow SQL query.
The native client polls this tiny response and downloads `GET /sync` only when
the revision changed or the local cache is absent. An unchanged poll does not
rewrite the local workspace. `GET /sync` returns
`{revision,state:null|object,updatedAt}`. `PUT /sync` accepts
`{revision,state}` and uses compare-and-swap in one transaction. A stale revision
returns 409 with `{error:'SYNC_CONFLICT',revision,state,updatedAt}` for the native
three-way merge; it never silently overwrites another device's settings.

Native synchronization captures the account before flushing local state, pins
every request to that account and cancels only its own requests when paused.
Applying a cloud update merges into a fresh atomic local Store mutation, keeping
downloads/history and edits made while the HTTP request was in flight. A first
offline account configuration uses an empty logical baseline so its later
bookmarks/layout edits survive another device's initial cloud state; a pristine
new login still receives the existing cloud settings.

The shared closed schema allows layouts/desktops, tab/bookmark URLs, theme,
appearance, language and selected simple settings. It rejects unknown fields,
local file/data URLs, embedded URL credentials and known auth-token parameters.
Per-account state is at most 2 MiB, 18 desktop definitions, 1000 tabs and 10000
bookmarks. Storage capacity does not grant paid desktop entitlement. Files,
captures, screenshots, page text, cookies, download payloads, history and site
password stores are not accepted. Metadata is stored in the private SQLite
database and protected in transit by TLS; it is **not** an end-to-end encrypted
cloud backup.

## Flash address book

- `PUT /flash/presence {}`: 90-second presence; heartbeat every 30 seconds only
  while the native Flash panel listens. Returns expiry and fresh certificate.
- `GET /flash/devices/:accountId`: `{account:null|{id,name,avatar},devices:[...]}`.
  Each live device has `deviceId,name,certificate,expiresAt`. The avatar is sent
  once per account, not duplicated for every device. Match its hash to the cert.
- `POST /flash/invitations`: `{recipientAccountId,recipientDeviceId,envelope}`,
  with strict `{v:1,ephemeralKey,nonce,ciphertext}` encrypted envelope ≤16 KiB.
  Sender identity is derived from the authenticated session, not request input.
- `GET /flash/invitations`: atomically consumes up to ten invitations for the
  current account/device. Returns `{invitations:[{invitationId,fromAccountId,
  fromDeviceId,envelope,expiresAt}]}`. Poll at most once every three seconds.

Invitations expire after five minutes, maximum ten queued per device and 512
per process; presence is capped at 2048 devices. Restart clears only temporary
presence/challenges/invitations. Direct payload transfer is independent of this
service once its handshake finishes. If a consumed invitation response is lost,
the sender may send a new invitation; there is no persistent file mailbox.

## Limits and verification

SQLite uses WAL, FULL synchronous commits, prepared statements, foreign keys,
short transactions and a **4 GiB main database page cap**. WAL/SHM are additional
bounded operational overhead, not user quota. Account capacity returns an error;
existing data is never deleted to make room. HTTP has 32 active requests held
through response completion, 128 connections, a shared 8 MiB body budget, route
body caps and deadlines. Authentication has independent bounded queues and rate
limits. These application limits complement process/cgroup/proxy limits on the
shared host; they do not promise hardware isolation or an arbitrary traffic SLA.

Run:

```sh
node --test services/mouse-identity/test/*.test.cjs desktop/mouse-account-client.test.cjs
node --test tools/test-mouse-account-registry.cjs
```

Tests use actual SQLite, real HTTP and Ed25519/X25519 cryptography. Native account
tests inject an explicit test protector/Keychain rather than claiming macOS
Keychain/Touch ID or two physical Macs were exercised.
