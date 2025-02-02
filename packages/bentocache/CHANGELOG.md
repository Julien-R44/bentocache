# bentocache

## 1.0.0

- eeb3c8c: BREAKING CHANGES:
  This commit changes the API of the `gracePeriod` option.
  - `gracePeriod` is now `grace` and should be either `false` or a `Duration`.
  - If you were using the `fallbackDuration` option, you should now use the `graceBackoff` option at the root level.
- 82e9d6c: Previously, `suppressL2Errors` was automatically enabled even when we had just a L2 layer. Which can be confusing, because errors were filtered out.

  Now `suppressL2Errors` is a bit more intelligent and will only be enabled if you have a L1 layer. Unless you explicitly set it to `true`.

- 716a423: BREAKING CHANGES :

  `undefined` values are forbidden in the cache. If you are trying to cache `undefined`, you will now get an error. This is a breaking change because it was previously allowed.

  If you want to cache something to represent the absence of a value, you can use `null` instead of `undefined`.

- 4478db6: BREAKING CHANGES

  ## API Changes for timeouts

  The timeout options have changed APIs:
  `{ soft: '200ms', hard: '2s' }`

  Becomes:

  ```ts
  getOrSet({ timeout: '200ms', hardTimeout: '2s' })
  ```

  You can now also use `0` for `timeout` which means that, if a stale value is available, then it will be returned immediately, and the factory will run in the background. SWR-like, in short.

  ## Default timeout

  Now, the default timeout is `0`. As explained above, this enables the SWR-like behavior by default, which is a good default for most cases and what most people expect.

- 7ae55e2: Added an `onFactoryError` option that allows to catch errors that happen in factories, whether they are executed in background or not.

  ```ts
  const result = await cache.getOrSet({
    key: 'foo',
    grace: '5s',
    factory: () => {
      throw new MyError()
    },
    onFactoryError: (error) => {
      // error is an instance of errors.E_FACTORY_ERROR
      // error.cause is the original error thrown by the factory
      // you can also check if the factory was executed in background with error.isBackgroundFactory
      // and also get the key with error.key. Will be `foo` in this case
    },
  })
  ```

- 27a295d: Keep only POJO syntax

  This commit remove the "legacy" syntax and only keep the POJO syntax.
  For each method, the method signature is a full object, for example :

  ```ts
  bento.get({ key: 'foo ' })
  bento.getOrSet({
    key: 'foo',
    factory: () => getFromDb(),
  })
  ```

- f0b1008: The memory driver can now accept `maxSize` and `maxEntrySize` in human format. For example, `maxSize: '1GB'` or `maxEntrySize: '1MB'`.

  We use https://www.npmjs.com/package/bytes for parsing so make sure to respect the format accepted by this module.

- a8ac574: This commit adds a new custom behavior for handling GetSet operation when end-user is using a single L2 storage without L1 cache.
