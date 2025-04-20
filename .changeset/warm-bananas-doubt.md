---
"bentocache": patch
---

Update clear method to use SCAN instead of KEYS for non-blocking. Also replace `del` commands with `unlink` since this is non blocking.
