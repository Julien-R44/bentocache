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

So this should be quite easy to implement. Feel free to take a lot at [the existing drivers](https://github.com/Julien-R44/bentocache/tree/main/packages/bentocache/src/drivers) implementations for inspiration. 

Also note that your driver will receive two additional parameters in the constructor : `ttl` and `prefix`. These parameters are common to every driver and their purpose is explained in the [options](../options.md) page.

Once you defined your driver, you can create a factory function that will be used by Bentocache to create instances of your driver at runtime. The factory function must be something like this:

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

## Create an adapter for the DatabaseDriver

If your want to use a database to store your cache entries, you don't need to create a full driver. You can leverage the adapter system available with the database driver.

We only ship adapter for Kysely and Knex to interact with the database for now. If ever you want to use another library, you can create your own adapter by implementing the `DatabaseAdapter` interface accessible from `bentocache/types`. The interface is defined as follows:

```ts
/**
 * Interface for a DatabaseAdapter that can be used with the DatabaseDriver
 */
export interface DatabaseAdapter {
  /**
   * Set the table name for the adapter
   */
  setTableName(tableName: string): void

  /**
   * Get an entry from the database
   */
  get(key: string): Promise<{ value: any; expiresAt: number | null } | undefined>

  /**
   * Delete an entry from the database
   *
   * You should return true if the entry was deleted, false otherwise
   */
  delete(key: string): Promise<boolean>

  /**
   * Delete multiple entries from the database
   *
   * Should return the number of entries deleted
   */
  deleteMany(keys: string[]): Promise<number>

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>

  /**
   * Create the cache table if it doesn't exist
   *
   * This method is responsible for checking it the table
   * exists before creating it
   */
  createTableIfNotExists(): Promise<void>

  /**
   * Remove expired entries from the cache table
   */
  pruneExpiredEntries(): Promise<void>

  /**
   * Clear all entries from the cache table
   */
  clear(prefix: string): Promise<void>

  /**
   * Set a value in the cache
   * You should also make sure to not create duplicate entries for the same key.
   * Make sure to use `ON CONFLICT` or similar
   */
  set(row: { key: string; value: any; expiresAt: Date | null }): Promise<void>
}
```

You can take a look at the code of the [Kysely adapter](https://github.com/Julien-R44/bentocache/blob/main/packages/bentocache/src/drivers/database/adapters/kysely.ts) or the [Knex adapter](https://github.com/Julien-R44/bentocache/blob/main/packages/bentocache/src/drivers/database/adapters/knex.ts) for inspiration.

Once you defined your adapter, you can create your own store that use the DatabaseDriver and your adapter:

```ts
export class PrismaAdapter implements DatabaseAdapter {
  // ...
}

import { DatabaseDriver } from '@bentocache/drivers/database'

export function prismaDriver(options: PrismaOptions): CreateDriverResult<DatabaseDriver> {
  return {
    config,
    factory: () => {
      const adapter = new PrismaAdapter(config)
      return new DatabaseStore(adapter, config)
    },
  }
}
```
## Tests

If you want to test your driver and its compliance, Bentocache is shipped with a test suite for [Japa](https://japa.dev/docs) that you can use. Note that you will also need to have `@japa/assert` installed. Then, you can use it like this:

```ts
// title: tests/my_driver.spec.ts
import { test } from '@japa/runner'
import { registerCacheDriverTestSuite } from 'bentocache/test_suite'
import { MyDriver } from '../src/my_driver.js'

test.group('My Driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) => new MyDriver({
      myOption: 'myValue',
      ...options
    }),
  })
})
```

Then just run your tests as usual with Japa.
