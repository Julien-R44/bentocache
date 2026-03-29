---
'bentocache': patch
---

Fixed crash when serialize is false in L1 with an L2 cache. L2 was storing serialized data in L1, causing a TypeError. Now L1 stores raw objects correctly.
