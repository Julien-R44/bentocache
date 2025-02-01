---
'bentocache': minor
---

Previously, `suppressL2Errors` was automatically enabled even when we had just a L2 layer. Which can be confusing, because errors were filtered out. 

Now `suppressL2Errors` is a bit more intelligent and will only be enabled if you have a L1 layer. Unless you explicitly set it to `true`.
