---
summary: "Comprehensive list of all methods available when using BentoCache"
---

# Methods

Below is a list of all the methods available when using BentoCache.

## namespace

Returns a new instance of the driver namespace. See [Namespaces](./namespaces.md) for more information.

```ts
const usersNamespace = bento.namespace('users');

usersNamespace.set('1', { name: 'John' });
usersNamespace.set('2', { name: 'Jane' });
usersNamespace.set('3', { name: 'Doe' });

usersNamespace.clear();
```

## get 

`get` allows you to retrieve a value from the cache. It returns `undefined` if the key does not exist.

#### get<T>(options: GetPojoOptions<T>) 

Returns the value of the key, or `undefined` if the key does not exist.

```ts
const products = await bento.get({
  key: 'products',
  defaultValue: [],
});
```

## set

Set a value in the cache.

```ts
await bento.set({
  key: 'products',
  value: products,
  grace: '5m',
})
```

## setForever

Set a value in the cache forever. It will never expire.

```ts
await bento.setForever({
  key: 'products',
  value: products,
  grace: '5m',
})
```

## getOrSet

This is the most powerful method of BentoCache. You should probably use this method most of the time.

It will try to get the value in the cache. If it exists, it will return it. If it does not exist, it will call the **factory** and set its return value in the cache.

```ts
// basic usage
const products = await bento.getOrSet({
  key: 'products',
  factory: () => fetchProducts()
})

// with options
const products = await bento.getOrSet({
  key: 'products',
  factory: () => fetchProducts(),
  ttl: '5m',
  grace: '1m',
})
```

The `getOrSet` factory function accepts an `ctx` object as argument that can be used to do multiple things:

### ctx.setTtl

`setTtl` allows you to set the TTL of the key dynamically. This is useful when the TTL depends on the value itself.

```ts
const products = await bento.getOrSet({
  key: 'token',
  factory: async (ctx) => {
    const token = await fetchAccessToken()

    options.setTtl(token.expiresIn)

    return token
  }
})
```

Auth tokens are a perfect example of this use case. The cached token should expire when the token itself expires. And we know the expiration time only after fetching the token. See [Adaptive Caching docs](./adaptive_caching.md) for more information.

### ctx.skip

Returning `skip` in a factory will not cache the value, and `getOrSet` will returns `undefined` even if there is a stale item in cache.
It will force the key to be recalculated on the next call.

```ts
cache.getOrSet({
  key: 'foo',
  factory: ({ skip, fail }) => {
    const item = await getFromDb()
    if (!item) {
      return skip()
    }

    return item
  }
})
```

### ctx.fail

Returning `fail` in a factory will not cache the value and will throw an error. If there is a stale item in cache, it will be used.

```ts
cache.getOrSet({
  key: 'foo',
  factory: ({ skip, fail }) => {
    const item = await getFromDb()
    if (!item) {
      return skip()
    }

    if (item.isInvalid) {
      return fail('Item is invalid')
    }

    return item
  }
})
```

## getOrSetForever

Same as `getOrSet`, but the value will never expire.

```ts
const products = await bento.getOrSetForever({
  key: 'products',
  factory: () => fetchProducts(),
})
```

## has

Returns `true` if the key exists in the cache, `false` otherwise.

```ts
const hasProducts = await bento.has({ key: 'products' })
```

## missing

Returns `true` if the key does not exist in the cache, `false` otherwise.

```ts
const missingProducts = await bento.missing({ key: 'products' })
```

## pull

Get the value of the key, and then delete it from the cache. Returns `undefined` if the key does not exist.

```ts
const products = await bento.pull({ key: 'products' })
```

## delete

Delete a key from the cache.

```ts
await bento.delete({ key: 'products' })
```

## deleteMany

Delete multiple keys from the cache.

```ts
await bento.deleteMany({ keys: ['products', 'users'] })
```

## clear

Clear the cache. This will delete all the keys in the cache if called from the "root" instance. If called from a namespace, it will only delete the keys in that namespace.

```ts
await bento.clear();
```

## disconnect

Disconnect from the cache. This will close the connection to the cache server, if applicable.

```ts
await bento.disconnect();
```
