---
'bentocache': minor
---

The memory driver can now accept `maxSize` and `maxEntrySize` in human format. For example, `maxSize: '1GB'` or `maxEntrySize: '1MB'`.

We use https://www.npmjs.com/package/bytes for parsing so make sure to respect the format accepted by this module.
