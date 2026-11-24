---
'bentocache': minor
---

feat(database): prune expired entries in batches (`pruneBatchSize`)

A single `delete ... where expires_at < now()` over a large cache table makes the
planner pick a sequential scan and keeps one transaction open for the whole
delete. On a table that grows to millions of rows that statement can outlive the
connection's `statement_timeout`, and the rollback throws away the work already
done — the table never shrinks while every run pays a full scan of it again.

`pruneBatchSize` opts into deleting that many rows per statement, each one inside
a short transaction and ordered by `expires_at` so it stays on the index. Also
prevents overlapping prune runs when a run outlasts `pruneInterval`.
