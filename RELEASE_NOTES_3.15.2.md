# OSMINOG Chrome 3.15.2 — GITHUB OWNER STATUS SYNC

- fixes contradictory GitHub state: a token is no longer called connected merely because `/user` succeeds;
- validates both `jeep-jim/OSMINOG` and `jeep-jim/OSMINOG-Releases` before granting Owner Max;
- classifies GitHub 404 from a private repository as missing fine-grained repository access and shows the exact remedy;
- requires write permission on both product repositories for Poseidon Owner Max;
- shares one `osminogOwnerGrantV1` result between Modules, Control Center, Presence capability mode and module_status;
- an already stored account-only token is shown as `GitHub аккаунт · Owner не подтверждён` instead of a misleading connected state.

No token value is copied into AI messages.
