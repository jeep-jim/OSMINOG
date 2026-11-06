# OSMINOG Chrome 4.0.25 — I/O Recovery

Clipboard status updates no longer re-enumerate disk folders. Folder reads serialize and coalesce; stale location results are ignored and failures are visible. Thumbnail reads are bounded and use a small cache. Saves retain the latest requested project state without a queue of cloned snapshots. Empty capture polls fetch matching keys rather than all project/backup values. Unchanged image signatures are reused and cold index scans yield between items.

Update/reload requests are retained until the new editor acknowledges readiness; disappeared tabs and transient tab errors are retried. Update preparation waits for a save.

No project schema, fixed extension identity or permissions are changed. Owner-device crashes are not reproduced or claimed resolved by a synthetic measurement. All existing runtime gates and new real extension directory/storage/reload checks must pass before publication.
