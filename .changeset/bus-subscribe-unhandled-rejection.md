---
'bentocache': patch
---

Fix an unhandled promise rejection when the bus subscription fails, for example when a cache is disconnected before its Redis bus connection is ready. The error is now logged instead of crashing the process.
