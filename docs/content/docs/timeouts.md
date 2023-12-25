# Timeouts

There are two distinct categories of timeouts that you can set up within bentocache, namely [soft timeouts](#soft-timeouts) and [hard timeouts](#hard-timeouts), each serving different purposes and behaviors in managing the maximum execution time of a factory.

As always, they can be configured at [Global, driver, or operations levels](./options.md).

## Soft timeouts

Soft timeouts are used only when you have enabled [grace periods](./grace_periods.md), and an entry still within this period is in the cache.

This allows you to set a maximum execution time for a factory. From the moment this time is exceeded, and an entry under grace period is still in the cache, it will be returned. And the factory will continue its execution in the background.

Imagine the following call:

```ts
const result = await bento.getOrSet('products', () => Product.all(), {
  gracePeriod: { enabled: true, duration: '6h' },
  timeouts: { soft: '200ms' }
});
```

Here, suppose we have an expired entry still under grace period in the cache. A new request comes in, so the factory `() => Product.all()` will be called.

- If the factory takes less than 200ms to execute, then the result will be returned and stored in the cache. No issues.
- However, if the factory takes more than 200ms, then the expired entry still under grace period will be returned immediately, and the factory will continue its execution in the background. This way, we can respond quickly to the user, and the next time this entry will be requested, it will be up to date.

:::warning
If no entry is still under grace period in the cache, then the soft timeout is not used.
:::

## Hard timeouts

Hard timeouts are also used to control the maximum execution time of a factory. The only difference here is that if the execution time is exceeded, an exception will be thrown, and you will have to handle this case in your code.

The factory will still continue its execution in the background.

```ts
const result = await bento.getOrSet('products', () => Product.all(), {
  timeouts: { hard: '1s' }
});
```

Here, if the factory takes more than 1s to execute, then an exception will be thrown. You can handle it like this:

```ts
import { errors } from 'bentocache'

try {
  const result = await bento.getOrSet('products', () => Product.all(), {
    timeouts: { hard: '1s' }
  });
} catch (e) {
  if (e instanceof errors.E_FACTORY_HARD_TIMEOUT) {
    // handle timeout
  }
}
```

Note that you can use both soft and hard timeouts at the same time. Hard timeout must of course be greater than soft timeout.

```ts
const result = await bento.getOrSet('products', () => Product.all(), {
  gracePeriod: { enabled: true, duration: '6h' },
  timeouts: { soft: '200ms', hard: '1s' }
});
```
