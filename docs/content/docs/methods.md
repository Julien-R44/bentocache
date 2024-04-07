---
summary: "Comprehensive list of all methods available when using BentoCache"
---

# Methods

Below is a list of all the methods available when using BentoCache.

### Single object vs multiple arguments

Most of the methods accept arguments in two different ways : either as a single argument or as an object. 

If you need to pass some specific options, the object way is probably the best choice since it is more "vertical" and may be easier to read. On the other hand, the single argument may be more concise when you don't need to pass specific options.

Example :

```ts
// multiple arguments
await bento.getOrSet('products', () => fetchProducts(), {
  ttl: '5m',
  gracePeriod: { enabled: true, duration: '1m' },
})

// is equivalent to
await bento.getOrSet({
  key: 'products',
  ttl: '5m',
  factory: () => fetchProducts(),
  gracePeriod: { enabled: true, duration: '1m' },
})
```

---

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

`get` allows you to retrieve a value from the cache. It returns `undefined` if the key does not exist.

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

#### get<T>(options: GetPojoOptions<T>) 

Same as above, but with an object as argument.

```ts
const products = await bento.get({
  key: 'products',
  defaultValue: [],
});
```

### set

Set a value in the cache.

```ts
await bento.set('products', products);
await bento.set('products', products, {
  gracePeriod: { enabled: true, duration: '5m' }
});

await bento.set({
  key: 'products',
  value: products,
  gracePeriod: { enabled: true, duration: '5m' }
})
```

### setForever

Set a value in the cache forever. It will never expire.

```ts
await bento.setForever('products', products);

await bento.setForever({
  key: 'products',
  value: products,
  gracePeriod: { enabled: true, duration: '5m' }
})
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

// with options as object
const products = await bento.getOrSet({
  key: 'products',
  ttl: '5m',
  factory: () => fetchProducts(),
  gracePeriod: { enabled: true, duration: '1m' },
})
```

The `getOrSet` factory function accepts an `options` object as argument that can be used to dynamically set some cache options. This can be particulary useful when caching options depends on the value itself.

```ts
const products = await bento.getOrSet('token', (options) => {
  const token = await fetchAccessToken()
  options.setTtl(token.expiresIn)
  return token
})
```

Auth tokens are a perfect example of this use case. The cached token should expire when the token itself expires. And we know the expiration time only after fetching the token.

### getOrSetForever

Same as `getOrSet`, but the value will never expire.

```ts
const products = await bento.getOrSetForever('products', () => fetchProducts())

const products = await bento.getOrSetForever({
  key: 'products',
  factory: () => fetchProducts(),
})
```

### has

Returns `true` if the key exists in the cache, `false` otherwise.

```ts
const hasProducts = await bento.has('products');
const hasProducts = await bento.has({ key: 'products' })
```

### missing

Returns `true` if the key does not exist in the cache, `false` otherwise.

```ts
const missingProducts = await bento.missing('products');
const missingProducts = await bento.missing({ key: 'products' })
```

### pull

Get the value of the key, and then delete it from the cache. Returns `undefined` if the key does not exist.

```ts
const products = await bento.pull('products');
const products = await bento.pull({ key: 'products' })
```

### delete

Delete a key from the cache.

```ts
await bento.delete('products');
await bento.delete({ key: 'products' })
```

### deleteMany

Delete multiple keys from the cache.

```ts
await bento.deleteMany(['products', 'users']);
await bento.deleteMany({ keys: ['products', 'users'] })
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

