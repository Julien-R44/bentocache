---
summary: "Discover BentoCache named caches feature. Learn how to define multiple cache stores in your application and use them distinctly"
---

# Named Caches

You can define several cache stores for your application and use them completely separately :

```ts
const bento = new BentoCache({
  default: 'memory',
  stores: {
    // One store named "memory". Only L1 in-memory cache
    memory: bentostore()
      .useL1Layer(memoryDriver({ maxSize: 10 * 1024 * 1024 })),

    // One store named "multitier" using full multi-tier cache
    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: 10 * 1024 * 1024 }))
      .useL2Layer(redisDriver({ connection: redisConnection }))
      .useBus(redisBusDriver({ connection: redisConnection })),

    // One store named "dynamo" using the dynamodb driver
    dynamo: bentostore()
      .useL2Layer(dynamodbDriver({ /* ... */ })),
  },
})
```

Also note the `default` property at the top level, which allows you to define the default store that will be used when you interact with the cache without specifying a store.

## Usage

To access the default cache, just use the methods directly on the bento object :

```ts
bento.getOrSet('foo', () => getFromDb(42))
bento.set('foo', 'bar')
bento.get('foo')
bento.delete('foo')
```

And to access a specific store, use the `.use()` method with the name of the store :

```ts
bento.use('multitier').getOrSet('foo', () => getFromDb(42))
bento.use('multitier').set('foo', 'bar')
bento.use('dynamo').get('foo')
bento.use('dynamo').delete('foo')
```

## Separation of Stores

In some cases, you may want to define two named caches that use the same backend. In this case, you will need to add a prefix to your keys to avoid collisions.

```ts
const bento = new BentoCache({
  default: 'users',
  stores: {
    users: bentostore()
      .useL2Layer(redisDriver({ prefix: 'users' })),

    posts: bentostore()
      .useL2Layer(redisDriver({ prefix: 'posts' }))
  },
})
```

Now, it will work as expected. There will be no collisions between the different keys, and when you use the `.clear()` function that allows you to delete all cache keys, you will only delete the keys of that specific store.

```ts
bento.use('users').set('foo', '2')
bento.use('users').get('foo') // '2'
bento.use('posts').get('foo') // undefined

bento.use('posts').set('foo', '1')
bento.use('posts').get('foo') // '1'

bento.use('users').clear()
bento.use('users').get('foo') // undefined
bento.use('posts').get('foo') // '1'
```
