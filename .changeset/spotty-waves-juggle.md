---
'bentocache': minor
---

Added an `onFactoryError` option that allows to catch errors that happen in factories, whether they are executed in background or not.

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
