---
summary: "Comprehensive list of all methods available when using BentoCache"
---

# Methods

Below is a list of all the methods available when using BentoCache.

### namespace

Returns a new instance of the driver namespace. See [Namespaces](./namespaces.md) for more information.

```ts
const usersNamespace = bento.namespace('users');

usersNamespace.set('1', { name: 'John' });
usersNamespace.set('2', { name: 'Jane' });
usersNamespace.set('3', { name: 'Doe' });

usersNamespace.clear();
```

### get 

`get` has multiple signatures and so it can be used in different ways.

#### get(key: string)

Returns the value of the key, or `undefined` if the key does not exist.

```ts
const products = await bento.get<string>('products'); 
//     ^? string | undefined | null
```

#### get<T>(key: string, defaultValue: T)

Returns the value of the key, or the default value if the key does not exist. 
Return type is inferred from the default value.

```ts
const products = await bento.get<string>('products', []);
//    ^? string[]
```

#### get<T>(key: string, defaultValue: T, options: GetOptions)

Same as above, but with custom [options](./options.md)

```ts
const products = await bento.get<string>('products', [], {
  // your options
});
```

### set

Set a value in the cache.

```ts
await bento.set('products', products);
await bento.set('products', products, {
  gracePeriod: { enabled: true, duration: '5m' }
});
```

### setForever

Set a value in the cache forever. It will never expire.

```ts
await bento.setForever('products', products);
```

### getOrSet

This is the most powerful method of BentoCache. You should probably use this method most of the time.

It will try to get the value in the cache. If it exists, it will return it. If it does not exist, it will call the **factory** and set its return value in the cache.

```ts
// basic usage
const products = await bento.getOrSet('products', () => fetchProducts())

// with options
const products = await bento.getOrSet('products', () => fetchProducts(), {
  ttl: '5m',
  gracePeriod: { enabled: true, duration: '1m' },
})
```

### getOrSetForever

Same as `getOrSet`, but the value will never expire.

```ts
const products = await bento.getOrSetForever('products', () => fetchProducts())
```

### has

Returns `true` if the key exists in the cache, `false` otherwise.

```ts
const hasProducts = await bento.has('products');
```

### missing

Returns `true` if the key does not exist in the cache, `false` otherwise.

```ts
const missingProducts = await bento.missing('products');
```

### pull

Get the value of the key, and then delete it from the cache. Returns `undefined` if the key does not exist.

```ts
const products = await bento.pull('products');
```

### delete

Delete a key from the cache.

```ts
await bento.delete('products');
```

### deleteMany

Delete multiple keys from the cache.

```ts
await bento.deleteMany(['products', 'users']);
```

### clear

Clear the cache. This will delete all the keys in the cache if called from the "root" instance. If called from a namespace, it will only delete the keys in that namespace.

```ts
await bento.clear();
```

### disconnect

Disconnect from the cache. This will close the connection to the cache server, if applicable.

```ts
await bento.disconnect();
```

