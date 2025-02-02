# @bentocache/plugin-prometheus

## 0.2.0

### Minor Changes

- eeb3c8c: BREAKING CHANGES:
  This commit changes the API of the `gracePeriod` option.
  - `gracePeriod` is now `grace` and should be either `false` or a `Duration`.
  - If you were using the `fallbackDuration` option, you should now use the `graceBackoff` option at the root level.

### Patch Changes

- Updated dependencies [eeb3c8c]
- Updated dependencies [82e9d6c]
- Updated dependencies [716a423]
- Updated dependencies [4478db6]
- Updated dependencies [7ae55e2]
- Updated dependencies [27a295d]
- Updated dependencies [f0b1008]
- Updated dependencies [a8ac574]
  - bentocache@1.0.0
