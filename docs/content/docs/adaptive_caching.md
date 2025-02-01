---
summary: Dynamically change the cache strategy based on the data being cached.
---

# Adaptive Caching

Adaptive caching is a method to dynamically change the cache options based on the data being cached. This approach is particularly useful when caching options depend on the value itself.

For example, authentication tokens are a perfect example of this use case. Consider the following scenario:

```ts
const authToken = await bento.getOrSet({
  key: 'token',
  factory: async () => {
    const token = await fetchAccessToken()
    return token
  },
  ttl: '10m'
})
```

In this example, we are fetching an authentication token that will expire after some time. The problem is, we have no idea when the token will expire until we fetch it. So, we decide to cache the token for 10 minutes, but this approach has multiple issues:

- First, if the token expires before 10 minutes, we will still use the expired token.
- Second, if the token expires after 10 minutes, we will fetch a new token even if the old one is still valid.

This is where adaptive caching comes in. Instead of setting a fixed TTL, we can set it dynamically based on the token's expiration time:

```ts
const authToken = await bento.getOrSet({
  key: 'token',
  factory: async (options) => {
    const token = await fetchAccessToken();
    options.setTtl(token.expiresIn);
    return token;
  }
});
```

And that's it! Now, the token will be removed from the cache when it expires, and a new one will be fetched.

There are other use cases for adaptive caching. For example, consider managing a news feed with BentoCache. You may want to cache the freshest articles for a short period of time and the older articles for a much longer period. 

Because the freshest articles are more likely to change: they may have typos, require updates, etc., whereas the older articles are less likely to change and may not have been updated for years.

Let's see how we can achieve this with BentoCache:

```ts
const namespace = bento.namespace('news');
const news = await namespace.getOrSet({
  key: newsId,
  factory: async (options) => {
    const newsItem = await fetchNews(newsId);

    if (newsItem.hasBeenUpdatedRecently) {
      options.setTtl('5m');
    } else {
      options.setTtl('2d');
    }

    return newsItem;
  }
});
```
