---
'bentocache': patch
---

Fix CROSSSLOT error when using `clear()` or `deleteMany()` with Valkey. Now uses pipeline with individual unlink commands instead of batch unlink.
