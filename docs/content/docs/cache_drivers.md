---
summary: The drivers available to use with BentoCache
---

# Cache drivers

Some options are common to all drivers. For more information about them, see the [options](./options.md) page. Here we will rather list the specifics of each driver.

## Redis

You will need to install `ioredis` to use this driver.

The Redis driver can be used with many different providers:
- Upstash
- Vercel KV
- DragonFly
- Redis Cluster


The driver uses the [ioredis](https://github.com/redis/ioredis) library under the hood. So all possible ioredis configurations are assignable when creating the bentocache driver. Feel free to look at their documentation for more details.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'

const bento = new BentoCache({
  default: 'redis',
  stores: {
    redis: bentostore().useL2Layer(redisDriver({
      connection: { host: '127.0.0.1', port: 6379 }
    }))
  }
})
```

It is also possible to directly pass an Ioredis instance to reuse the connection.

```ts
import { Redis } from 'ioredis'

const ioredis = new Redis()

const bento = new BentoCache({
  default: 'redis',
  stores: {
    redis: bentostore().useL2Layer(redisDriver({
      connection: ioredis
    }))
  }
})
```

| Option | Description | Default |
| --- | --- | --- |
| `connection` | The connection options to use to connect to Redis or an instance of `ioredis` | N/A |

## Filesystem

The filesystem driver will store your cache in a distributed way in several files/folders on your filesystem.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { fileDriver } from "bentocache/drivers/file";

const bento = new BentoCache({
  default: 'file',
  stores: {
    redis: bentostore().useL2Layer(fileDriver({
      directory: './cache'
    }))
  }
})
```

| Option | Description | Default |
| --- | --- | --- |
| `directory` | The directory where the cache files will be stored. | N/A |

## Memory

The memory driver will store your cache directly in memory.

Use [node-lru-cache](https://github.com/isaacs/node-lru-cache) under the hood.


```ts
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

const bento = new BentoCache({
  default: 'memory',
  stores: {
    memory: bentostore().useL1Layer(memoryDriver({
      maxSize: 10 * 1024 * 1024,
      maxItems: 1000
    }))
  }
})
```

| Option | Description | Default |
| --- | --- | --- |
| `maxSize` | The maximum size of the cache **in bytes**. | N/A |
| `maxItems` | The maximum number of entries that the cache can contain. Note that fewer items may be stored if you are also using `maxSize` and the cache is full. | N/A |
| `maxEntrySize` | The maximum size of a single entry in bytes. | N/A |

## DynamoDB

DynamoDB is also supported by bentocache. You will need to install `@aws-sdk/client-dynamodb` to use this driver.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { dynamoDbDriver } from 'bentocache/drivers/dynamodb'

const bento = new BentoCache({
  default: 'dynamo',
  stores: {
    dynamo: bentostore().useL2Layer(dynamoDbDriver({
      endpoint: '...',
      region: 'eu-west-3',
      table: {
        name: 'cache' // Name of the table
      },

      // Credentials to use to connect to DynamoDB
      credentials: {
        accessKeyId: '...',
        secretAccessKey: '...'
      }
    }))
  }
})
```

You will also need to create a DynamoDB table with a string partition key named `key`. You must create this table before starting to use the driver.

| Option | Description | Default |
| --- | --- | --- |
| `table.name` | The name of the table that will be used to store the cache. | `cache` |
| `credentials` | The credentials to use to connect to DynamoDB. | N/A |
| `endpoint` | The endpoint to use to connect to DynamoDB. | N/A |
| `region` | The region to use to connect to DynamoDB. | N/A |


:::warning
Be careful with the `.clear()` function of the DynamoDB driver. We do not recommend using it. Dynamo does not offer a "native" `clear`, so we are forced to make several API calls to: retrieve the keys and delete them, 25 by 25 (max per `BatchWriteItemCommand`).

So using this function can be costly, both in terms of execution time and API request cost. And also pose rate-limiting problems. Use at your own risk.
:::

## Databases

We offer several drivers to use a database as a cache. Under the hood, we use [Knex](https://knexjs.org/). So all Knex options are available, feel free to check out the documentation.

All SQL drivers accept the following options:

| Option | Description | Default |
| --- | --- | --- |
| `tableName` | The name of the table that will be used to store the cache. | `bentocache` |
| `autoCreateTable` | If the cache table should be automatically created if it does not exist. | `true` |
| `connection` | The connection options to use to connect to the database or an instance of `knex`. | N/A |

### PostgreSQL

You will need to install `pg` to use this driver.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { postgresDriver } from 'bentocache/drivers/sql'

const bento = new BentoCache({
  default: 'pg',
  stores: {
    pg: bentostore().useL2Layer(postgresDriver({
      connection: { 
        user: 'root', 
        password: 'root', 
        database: 'postgres', 
        port: 5432 
      }
    }))
  }
})
```

### MySQL

You will need to install `mysql2` to use this driver.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { mysqlDriver } from 'bentocache/drivers/sql'

const bento = new BentoCache({
  default: 'mysql',
  stores: {
    mysql: bentostore().useL2Layer(mysqlDriver({
      connection: { 
        user: 'root', 
        password: 'root', 
        database: 'mysql', 
        port: 3306
      },
    }))
  }
})
```

### SQLite ( better-sqlite3 )

You will need to install `better-sqlite3` to use this driver.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { betterSqliteDriver } from 'bentocache/drivers/sql'

const bento = new BentoCache({
  default: 'sqlite',
  stores: {
    sqlite: bentostore().useL2Layer(betterSqliteDriver({
      connection: { filename: 'cache.sqlite3' },
    }))
  }
})
```

### SQLite ( sqlite3 )

You will need to install `sqlite3` to use this driver.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { sqliteDriver } from 'bentocache/drivers/sql'

const bento = new BentoCache({
  default: 'sqlite',
  stores: {
    sqlite: bentostore().useL2Layer(sqliteDriver({
      connection: { filename: 'cache.sqlite3' },
    }))
  }
})
```
