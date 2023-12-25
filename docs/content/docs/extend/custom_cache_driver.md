---
summary: Learn how to create a custom cache driver for BentoCache
---

# Create a custom cache driver

Extending BentoCache with your own cache driver is easy. What you need is a class that implements the `L1CacheDriver` or `L2CacheDriver` interfaces accessible from `bentocache/types`. The interface is defined as follows:

```ts
interface L2CacheDriver {
  /**
   * Returns a new instance of the driver namespace
   */
  namespace(namespace: string): CacheDriver

  /**
   * Get a value from the cache
   */
  get(key: string): Promise<string | undefined>

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull(key: string): Promise<string | undefined>

  /**
   * Put a value in the cache.
   * If `ttl` is not defined, the value will be stored forever
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: string, ttl?: number): Promise<boolean>

  /**
   * Check if a key exists in the cache
   */
  has(key: string): Promise<boolean>

  /**
   * Remove all items from the cache
   */
  clear(): Promise<void>

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string): Promise<boolean>

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]): Promise<boolean>

  /**
   * Closes the connection to the cache.
   * Some drivers may not need this
   */
  disconnect(): Promise<void>
}
```

Similarly, the `L1CacheDriver` interface is the same, except that it is not async. 

So this should be quite easy to implement. Feel free to take a lot at [the existings drivers](https://github.com/Julien-R44/bentocache/tree/develop/drivers) implementations for inspiration. 

Also note that your driver will receive two additional parameters in the constructor : `ttl` and `prefix`. These parameters are common to every drivers and their purpose is explained in the [options](../options.md) page.

Once you defined you driver, you can create a factory function that will be used by Bentocache to create instances of your driver at runtime. The factory function must be something like this:

```ts
import type { CreateDriverResult } from 'bentocache/types'

export function myDriver(options: MyDriverOptions): CreateDriverResult<MyDriver> {
  return {
    options,
    factory: (config: MyDriverOptions) => new MyDriver(config)
  }
}
```

Finally, you can use your driver when creating a new instance of Bentocache:

```ts
import { BentoCache, bentostore } from 'bentocache'

const bento = new BentoCache({
  default: 'myStore',
  stores: {
    myStore: bentostore()
      .useL2Layer(myDriver({ /* Your driver options */ }))
  }
})
```

## Tests

If you want to test your driver and its compliance, Bentocache is shipped with a test suite for [Japa](https://japa.dev/docs) that you can use. Note that you will also need to have `@japa/assert` installed. Then, you can use it like this:

```ts
// title: tests/my_driver.spec.ts
import { test } from '@japa/runner'
import { registerCacheDriverTestSuite } from 'bentocache/test_suite'
import { MyDriver } from '../src/my_driver.js'

registerCacheDriverTestSuite({
  test,
  driver: MyDriver,
  config: {
    // Your driver options
  }
})
```

Then just run your tests as usual with Japa.
