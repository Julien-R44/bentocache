---
summary: Quick walkthrough of how Bentocache can help you improve your application's performance and resilience.
---

# Walkthrough guide

Let's try to take a real-word scenario to see how can Bentocache can help us. 

We have a simple JSON API that is serving some products. Our JSON API is backed with PM2 and run in cluster modes with 3 instances equally served with round-robin distribution. 

Let's also imagine the given numbers in a 10-minute window :

- Every 10 seconds, 1,000 different products are requested on each instance, with 100 concurrent requests for each product.
- The database is down for the last 3 minutes of the 10-minute window.

That means, without any caching, here's how the numbers would look like :
- **Every 10 Seconds**: 1,000 x 100 x 3 = 300,000 database calls.
- **Every Minute**: 300,000 x 6 = 1,800,000 database calls.
- **Every 10 Minutes**: 1,800,000 x 10 = 18,000,000 database calls.

This is a lot of database calls. Here is the code of our API :

```ts
// title: API
router.get('/products/:id', async (req, res) => {
  const productId = req.params.id
  const product = await Product.find(productId)

  res.json(product)
})
```

In this current state, every time we call the endpoint, we will end up fetching the product from the database. This results, as we saw above, in **1.800.000 database calls in 10 minutes**. Let's see how we can improve this.

## Adding a memory-cache

Now, let's make the first easy step by adding a simple memory-cache to our app :

```ts
// title: Memory Cache
const bento = new BentoCache({
  default: 'cache',
  stores: { 
    cache: bentostore().useL1Layer(memoryDriver())
  }
})

router.get('/products/:id', async (req, res) => {
  const productId = req.params.id
  const product = await bento.getOrSet(
    `product:${productId}`, 
    () => Product.find(productId), 
    { ttl: '1m' }
  )

  res.json(product)
})
  ```

By caching the product for 1 minute, we significantly reduce the database load by making only one request per minute, per product and per instance. However, we still need to consider the 3 minutes of downtime when we can't cache anything, so we'll keep hitting the database.

**Database calls in 10m before: 18,000,000**<br/>
**Database calls in 10m: 8,400,000**

<details>
<summary>Click to see the calculation</summary>
<br/>

**Normal Operations (7 minutes):**
- Database calls per minute: 300,000<br/>
<small style="margin-left: 15px">1,000 products * 100 concurrent requests * 3 instances</small>
- Total database calls: 3,000,000<br/>
<small style="margin-left: 15px">300,000 calls * 7 minutes</small>

**During Downtime (3 minutes):**
- Database Calls per Minute: 1,800,000<br/>
<small style="margin-left: 15px">1,000 products * 100 concurrent requests * 3 instances * 6 ( every 10 seconds )</small>
- Total database calls: 5,400,000<br/>
<small style="margin-left: 15px">1,800,000 calls * 3 minutes</small>

</details>

## Cache Stampede protection

If we look at the above calculation, it is not exactly true. We made the assumption Bentocache hasn't any stampede protection mechanism. Let me explain :

We said we were receiving 100 concurrent requests for each 1.000 products. That means, at the start of each minute, when entries are expired, we will have 100 concurrent requests trying to fetch the same product from the database. This is called a cache stampede. And guess what, Bentocache has a built-in mechanism to prevent this. And this is totally transparent for you.

So if we take this into account, results would be : 

**Database calls in 10m before: 8,400,000**<br/>
**Database calls in 10m: 5,430,000**

Note that in downtime case, we are not benefiting from the cache stampede protection. This is because we are not able to cache anything during this time. We will see later how we can improve this.

<details>
<summary>Click to see the calculation</summary>
<br/>

**Normal Operations (7 minutes):**
- Database calls per minute: 3,000<br/>
<small style="margin-left: 15px">1,000 products * 3 instances</small>
- Total database calls: 30,000<br/>
<small style="margin-left: 15px">3,000 calls * 7 minutes</small>

**During Downtime (3 minutes):**
- Database Calls per Minute: 1,800,000<br/>
<small style="margin-left: 15px">1,000 products * 100 concurrent requests * 3 instances * 6 ( every 10 seconds )</small>
- Total database calls: 5,400,000<br/>
<small style="margin-left: 15px">1,800,000 calls * 3 minutes</small>

</details>

## Adding grace periods

We have this nasty problem where the database is down during 3 minutes.  During this period, since we're using a 1-minute TTL, we can't cache anything, causing an overload of database calls and probably forcing us to show an error page to users. But there's a way to enhance our system's resilience: grace periods.

Grace periods extend the time that cached data can be served even after their expiration. They improve not only system robustness during downtimes but also the user experience under heavy load.

```ts
// title: Grace Period
const bento = new BentoCache({
  default: 'cache',
  // highlight-start
  gracePeriod: {
    enabled: true,
    duration: '6h',
    fallbackDuration: '30s'
  },
  // highlight-end
  stores: {
    cache: bentostore().useL1Layer(memoryDriver()) 
  }
})

router.get('/products/:id', async (req, res) => {
  const productId = req.params.id
  const product = await bento.getOrSet(
    `product:${productId}`, 
    () => Product.find(productId), 
    { ttl: '1m' }
  )

  res.json(product)
})
```

By setting up grace period, **we won't have any downtime for our users**. This is the first great thing to have.

Let's also see how it improved the round trips to our database. During the 3 minute downtime, Bentocache's grace period feature becomes crucial. Even though the cached value might be a little stale, it's still available to serve. This approach is far better than displaying an error page to users, and it ensures continued service availability.

A particular aspect to highlight is the `fallbackDuration` parameter, set here to 30 seconds. In our scenario, if the database call fails, Bentocache will serves the expired data for these 30 seconds without even trying to call the factory. After this period, it will try to call the factory again. And if it fails again, it will serve the expired data for another 30 seconds. This process will repeat until the database is back online.

By avoiding repeated calls to the database when the factory fails, it prevents what could be **likened to a self-inflicted DDoS attack**. It not only maintains service but does so in a way that doesn't further strain the system.

In summary, that means, during this downtime of 3 minutes, we now only have 2 calls per minute to our database. This gives : 

**Database calls in 10m before: 5,430,000**<br/>
**Database calls in 10m: 39,000**

This is a huge improvement. Sure, we are serving some stale data, but dependending on your use case, this is probably acceptable and better than showing an error page to your users.

<details>
<summary>Click to see the calculation</summary>
<br/>

**Normal Operations (7 minutes):**
- Database calls per minute: 3,000<br/>
<small style="margin-left: 15px">1,000 products * 3 instances</small>
- Total database calls: 30,000<br/>
<small style="margin-left: 15px">3,000 calls * 7 minutes</small>

**During Downtime (3 minutes with Grace Period):**
- Database Calls per Minute: 1,000<br/>
<small style="margin-left: 15px">1,000 products * 3 minutes * 1 factory calls * 3 nodes</small>
- Total database calls: 9,000<br/>
<small style="margin-left: 15px">1,000 calls * 3 minutes * 3 nodes</small>
</details>


## Adding a distributed cache behind our memory-cache

Up until now, we've been working with a memory cache that has its own limitations, particularly when dealing with multiple instances. Each instance maintains its state, leading to potential redundancy and inefficiency in data retrieval. To illustrate this, consider the following scenario:

- Instance `N1` receives a request for `product:42` and fetches the product from the database, caching it in memory.
- Soon after, instance `N2` receives a request for the same `product:42`. Since it has its separate memory-cache, it won't find the product and will have to retrieve it from the database again.

See the problem ? Let's introduce our Multi-Tier cache setup :

```ts
// title: Hybrid driver
const connection = process.env.REDIS_CREDENTIALS!
const bento = new BentoCache({
  default: 'cache',
  gracePeriod: { 
    enabled: true, 
    duration: '6h', 
    fallbackDuration: '30s' 
  },
  stores: { 
    cache: bentostore()
      .useL1Layer(memoryDriver())
      .useL2Layer(redisDriver({ connection }))
      .useBus(redisBusDriver({ connection }))
  },
})

router.get('/products/:id', async (req, res) => {
  const productId = req.params.id
  const product = await bento.getOrSet(
    `product:${productId}`, 
    () => Product.find(productId), 
    { ttl: '1m' }
  )

  res.json(product)
})
```

Nice. We now have a robust two-level cache system. It also introduces a new concept: the Bus. Though we won't dive deep into it here, the bus serves as a mechanism to synchronize the various memory caches across instances, ensuring consistent state. More details can be found in the [Multi-tier documentation](./multi_tier.md).

Returning to our original problem of different instances redundantly fetching the same data from the database, let's estimate that this occurs 35% of the time. By using a multi-tier cache and bus, we can reduce database calls by this percentage.

- We previously calculated 39,000 requests in 10 minutes.
- With the new setup, we have reduced this to 25,350 requests in 10 minutes (39,000 * 0.65).

**Database calls in 10m before: 39,000**<br/>
**Database calls in 10m: 25,350**

## Adding soft timeouts

We have likely achieved a more rational amount of database calls at this stage. 

However, it sometimes happens that the database's response time is prolonged, sometimes taking up to 2 seconds. This delay becomes an issue when a key has just expired and must be refreshed, leaving the end-user waiting for the database's response before accessing the data. This is the scenario where soft timeouts become essential.

```ts
// title: Soft timeouts
const connection = process.env.REDIS_CREDENTIALS!
const bento = new BentoCache({
  default: 'cache',
  gracePeriod: { 
    enabled: true, 
    duration: '6h', 
    fallbackDuration: '30s' 
  },
  // highlight-start
  timeouts: {
    soft: '500ms',
  },
  // highlight-end
  stores: { 
    cache: bentostore()
      .useL1Layer(memoryDriver())
      .useL2Layer(redisDriver({ connection }))
      .useBus(redisBusDriver({ connection }))
  },
})

router.get('/products/:id', async (req, res) => {
  const productId = req.params.id
  const product = await bento.getOrSet(
    `product:${productId}`, 
    () => Product.find(productId), 
    { ttl: '1m' }
  )

  res.json(product)
})
```

Soft timeouts operate alongside grace periods. In this example, a soft timeout of 200ms has been configured. If the factory (ie the database call) takes more than 200ms to execute, and grace period data is still available, that data will be returned. 

During this time, the factory will continue to run in the background. And the next time the key is requested, it will be fresh and immediately returned.

## Conclusion

There are some other features to discover in Bentocache that can help you improve your user experience, resilience, and response time. But I believe this is a good introduction. 

By using different features of Bentocache, we were able to reduce the number of database calls **from 18,000,000 to 25,350**. We even managed to reduce the **response time to a maximum of 500ms instead of 2s** sometimes. These are all fictional numbers and a highly theoretical scenario, but I hope you get the idea of how Bentocache can help you.
