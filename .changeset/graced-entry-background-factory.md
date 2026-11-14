---
'bentocache': patch
---

Pass `gracedEntry` to factories that refresh a stale value in the background (`timeout: 0`, the default). It was always `undefined` there, so a background refresh couldn't tell it had a stale value to fall back on.
