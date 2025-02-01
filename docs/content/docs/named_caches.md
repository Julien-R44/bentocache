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
      .useL1Layer(memoryDriver({ maxSize: '10mb' })),

    // One store named "multitier" using full multi-tier cache
    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: '10mb' }))
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
bento.getOrSet({ key: 'foo', factory: () => getFromDb(42) })
bento.set({ key: 'foo', value: 'bar' })
bento.get({ key: 'foo' })
bento.delete({ key: 'foo' })
```

And to access a specific store, use the `.use()` method with the name of the store :

```ts
bento.use('multitier').getOrSet({ key: 'foo', factory: () => getFromDb(42) })
bento.use('multitier').set({ key: 'foo', value: 'bar' })
bento.use('dynamo').get({ key: 'foo' })
bento.use('dynamo').delete({ key: 'foo' })
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
bento.use('users').set({ key: 'foo', value: '2' })
bento.use('users').get({ key: 'foo' }) // '2'
bento.use('posts').get({ key: 'foo' }) // undefined

bento.use('posts').set({ key: 'foo', value: '1' })
bento.use('posts').get({ key: 'foo' }) // '1'

bento.use('users').clear()
bento.use('users').get({ key: 'foo' }) // undefined
bento.use('posts').get({ key: 'foo' }) // '1'
```
