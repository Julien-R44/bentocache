---
summary: How BentoCache protects you from cache stampede and how it works
---


# Stampede Protection

To begin with, what is a [Cache Stampede](https://en.wikipedia.org/wiki/Cache_stampede)?

A cache stampede occurs when multiple clients request the same key that is not present in the cache. In this case, all clients will go and fetch the value from the source of truth (such as a database) and update the cache with the value they have retrieved.

Imagine this simple route that allows retrieving a post by its ID.

```ts
router.get('/posts/:id', async (request) => {
  const { id } = request.params
  
  const post = await bento.getOrSet({
    key: `post:${id}`, 
    factory: () => getPostFromDb(id),
    ttl: '1h',
  })
  
  return user
})
```

So internally we use a cache to avoid fetching the post from the database every time a client requests the post. Therefore, we cache the post for 1 hour.

**Now imagine the following scenario**: we arrive 1 hour after the post has been cached, and 10k clients request the post at the same time.

Without cache stampede protection, what will happen is that the function `getPostFromDb` will **be executed 10k times simultaneously**, and thus **10k queries will be sent to the database**.

This can indeed put you in a rather complicated situation where your database may become overloaded, or even crash, and consequently, your entire app is down.

To avoid this kind of situation, BentoCache offers protection against cache stampede.

## What BentoCache Does

Basically, BentoCache will use an **in-memory** lock system to prevent the factory, in our case the function `getPostFromDb`, from being executed multiple times simultaneously.

- When a client requests a key that is not present in the cache, BentoCache will create a lock for that key. Then, it will execute the factory and store the value in the cache.
- Other concurrent requests will wait for the lock to be released.
- Once the lock is released by the first request, the other requests will directly retrieve the value from the cache and return it.

Now, if we take the same scenario with the 10k clients requesting the post at the same time, **then there will be only one execution of the factory** and consequently **only one query to the database** for the 10k requests.

## Multi-Instance Applications

If you have followed along, you have probably noticed that we were talking about **in-memory** locks. Consequently, what about multi-instance applications?

Well, in truth, this is not really a problem. Indeed, there will be more than one query to the database, but still far fewer than 10k. Because each instance of your app will have its own lock system.

Given the same scenario with the 10k users. Imagine that your application is running in cluster mode with PM2 and you have 10 instances of your app. Also, imagine that the 10k requests are distributed equally across the 10 instances.

This results in 1k requests per instance. And so, it will lead to **10 queries to the database instead of 10k**, with the help of our protection.
