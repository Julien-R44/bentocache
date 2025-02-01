---
'bentocache': minor
'@bentocache/plugin-prometheus': minor
---

BREAKING CHANGES: 
This commit changes the API of the `gracePeriod` option. 
- `gracePeriod` is now `grace` and should be either `false` or a `Duration`. 
- If you were using the `fallbackDuration` option, you should now use the `graceBackoff` option at the root level.
