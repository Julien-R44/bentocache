---
summary: "Explore the concept of grace periods in BentoCache: extending the life of cached data beyond its TTL for enhanced resilience. Understand how it improves user experience during downtimes and ensures continuous data access."
---

# Grace periods

Grace periods allow cached data to be served for an extended time after their expiration, enhancing resilience and user experience during downtimes or heavy loads on your data source.

## What is a grace period?

When caching, you are always specifying a TTL (time to live) for your cache entries. This is the amount of time that the cache entry will be valid for. Once the TTL has expired, the cache entry will be considered stale and will be forgotten forever.

Then, when the cache entry is requested again but not found, you will have to fetch the data from the source of truth (database, API, etc...), and store it in the cache again.

But what if your source of truth is down? Wouldn't it be nice to be able to serve stale data for a little while, until your source of truth is back up?

This is what grace periods are for. This grace period will be the duration during which an entry will still be available, even if it is stale.

## How to use grace periods

Grace periods can be configured at global, driver and operations levels. See the [options](./options.md) documentation for more details.

Let's imagine you have a simple controller that fetches a user from the database, and caches it for 10 minutes:

```ts
bento.getOrSet({
  key: 'users:1',
  factory: () => User.find(1),
  ttl: '10m',
})
```

Now, let's say your cache is empty. Someone request the user with id 1, but, the database is down, for any reasons. Without grace periods, this request will just fail and **will display an error to the user**.

Now what if we add a grace period ?

```ts
bento.getOrSet({
  key: 'users:1',
  factory: () => User.find(1),
  ttl: '10m',
  grace: '6h',
})
```

- First time this code is executed, user will be fetched from database, stored in cache for **10 minutes** with a grace period of **6 hours**.
- **11 minutes later**, someone request the same user. The cache entry is logically expired, but the grace period is still valid.
- So, we try to call the factory again to refresh the cache entry. But oops, **the database is down** ( or factory is failing for any other reasons ). 
- Since we are still in the grace period of 6h, we will serve the stale data from the cache.

As a result, instead of displaying an error page to the user, we are serving data that's a little out of date. Depending on your use case, this can result in a much better user experience.

## Backoff strategy

If the factory is failing, you can also use a backoff strategy to retry the factory only after a certain amount of time. This is useful to avoid hammering your database or API when it's down.

```ts
bento.getOrSet({
  key: 'users:1',
  factory: () => User.find(1),
  ttl: '10m',
  grace: '6h',
  graceBackoff: '5m',
})
```

In this example, if the factory fails, we will wait 5 minutes before trying again.
