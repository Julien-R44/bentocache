---
summary: Associate tags with your cache keys to easily invalidat a bunch of keys at once
---

# Tags

:::warning
Tags are available since v1.2.0 and still **experimental**. 

We will **not** make breaking changes without a major version, but no guarantees are made about the stability of this feature yet.

Please if you find any bugs, report them on Github issues.
:::


Tagging allows associating a cache entry with one or more tags to simplify invalidation. Instead of managing individual keys, entries can be grouped under multiple tags and invalidated in a single operation.

## Usage

```ts
await bento.getOrSet({
  key: 'foo',
  factory: getFromDb(),
  tags: ['tag-1', 'tag-2']
});

await bento.set({ key: 'foo', tags: ['tag-1'] });
```

To invalidate all entries linked to a tag:

```ts
await bento.deleteByTags({ tags: ['tag-1'] });
```

Now, imagine that the tags depend on the cached value itself. In that case, you can use [adaptive caching](./adaptive_caching.md) to update tags dynamically based on the computed value.

```ts
const product = await bento.getOrSet({
  key: `product:${id}`,
  factory: async (ctx) => {
    const product = await fetchProduct(id);
    ctx.setTags(product.tags);
    return product;
  }
})
```


## How it works

If you are interested in how Bentocache handles tags internally, read on.

Generally, there are two ways to implement tagging in a cache system:

- **Server-side tagging**: The cache backend (e.g., Redis, Memcached, databases) is responsible for managing tags and their associated entries. However, most distributed caches do not natively support tagging. When it's not supported, workarounds exist, but they are either inefficient or complex to implement.

- **Client-side tagging**: The caching library manages tags internally. This is the approach used by Bentocache.

Bentocache implements **client-side tagging**, making it fully backend-agnostic. Instead of relying on the cache backend to track and delete entries by tags, Bentocache tracks invalidation timestamps for each tag and filters out stale data dynamically.

This means all Bentocache drivers automatically support tagging without any modification. If someone implements a custom driver, tagging will work out of the box, without requiring any additional logic.

### Why avoid server-side tagging

Among all the cache backends Bentocache supports, none provide a native tagging system without significant overhead. Of course, something could probably be hacked together on top of all drivers, but it would probably be inefficient and also pretty complex to implement, depending on the backend.

For example:

- In Redis, tagging could be hacked together using Redis sets, but this would require complex management and would not be efficient for large datasets.
- In databases, a separate table mapping cache keys to tags could be used, but this would significantly increase query complexity and also reduce performance.

By performance, I mean that to delete all keys associated with a tag, you’d typically need to run a query like:

```sql
DELETE * FROM cache WHERE "my-tag" IN tags;
```

This approach does not scale in a distributed cache with millions of entries, as scanning large datasets in real-time would be extremely slow and inefficient.

### How Bentocache handles tags

Instead of directly deleting entries with a given tag, Bentocache uses a more efficient approach.

Core idea is pretty simple:
- When a tag is invalidated, Bentocache stores an **invalidation timestamp** in the cache.
- When fetching an entry, Bentocache checks whether it was cached before or after its associated tags were invalidated.

Let's take a concrete example. Here we just cached an entry with the tags `tag-1` and `tag-2`:

```ts
await bento.getOrSet({
  key: 'foo',
  factory: getFromDb(),
  tags: ['tag-1', 'tag-2']
});
```

Internally, Bentocache stores something like:

```ts
foo = { value: 'bar', tags: ['tag-1', 'tag-2'], createdAt: 1700000 }
```

Note that we also store the creation date of the entry as `createdAt`.

Now, we invalidate the `tag-1` tag:

```ts
await bento.deleteByTags({ tags: ['tag-1'] });
```

Instead of scanning and deleting every entry associated with `tag-1`, Bentocache simply stores the invalidation timestamp under a special cache key:

```ts
__bentocache:tags:tag-1 = { invalidatedAt: 1701234 }
```

So, we store the invalidation timestamp of the tag under the key `__bentocache:tags:tag-1`. This means that any cache entry associated with tag-1 created before `1700001234` is now considered stale.

Now, when fetching an entry, Bentocache checks if it was created before the tag was invalidated. If it was, Bentocache considers the entry stale and ignores it.

In fact, the implementation is a bit more complex than that, but that's the general idea. 

## Limitations

The main limitation of this system is that you should avoid using too many tags on a single entry. The more tags you use per entry, the more invalidation timestamps Bentocache needs to store and especially check when fetching an entry. This can increase lookup times and impact performance. 

In fact, the same issue exists in other systems like Loki, OpenTelemetry, TimescaleDB etc.. where it's known as the "high cardinality" problem. To maintain optimal performance, it's recommended to **keep the number of tags per entry reasonable**.

## Acknowledgements

The concept of client-side tagging in Bentocache was **heavily inspired** by the huge work done by Jody Donetti on [FusionCache](https://github.com/ZiggyCreatures/FusionCache).

Reading his detailed explanations and discussions on GitHub provided invaluable insights into the challenges and solutions in implementing an efficient tagging system.

A **huge thanks** for sharing his expertise and paving the way for innovative caching strategies
