---
'bentocache': patch
---

Fix `has` returning `true` on entries previously deleted by tag (see #64). The `has` method now relies on the driver's internal `get` method instead of `has`. This means the driver's `has` implementation is no longer used, and if you maintain a custom driver, you can safely remove it.
