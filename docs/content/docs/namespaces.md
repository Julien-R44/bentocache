---
summary: "Learn about BentoCache's system for grouping cache entries using Namespaces. It helps keep things organized and makes clearing related entries a breeze."
---

# Namespaces

Namespaces are a way to organize your cache entries by grouping them into some categories and hierarchies. They are also useful when you want to invalidate a whole group of keys in one go.

Basically, what BentoCache does internally is it prefixes all the keys with the namespace you provide.

Let's take an example. 

```ts
const usersNamespace = bento.namespace('users');

bento.set('products', products)
usersNamespace.set({ key: '1', value: { name: 'John' } });
usersNamespace.set({ key: '2', value: { name: 'Jane' } });
usersNamespace.set({ key: '3', value: { name: 'Doe' } });

usersNamespace.clear();
```

Here, the `bento.namespace('users')` call will return a new instance of the driver. Further calls to methods via this instance will basically automatically prefix the keys with `users:`.

So, the `usersNamespace.set({ key: '1', value: { name: 'John' } })` call will actually set the key `users:1` in the cache.
Similarly, the `usersNamespace.clear()` call will clear only the keys that start with `users:`.

Therefore, the `products` key will not be affected by the `usersNamespace.clear()` call. It will only clear the `users:1`, `users:2` and `users:3` keys.

## Some notes

- By calling `bento.clear()` with the "root" instance, you will clear ALL keys in the cache, regardless of the namespace.
- Namespaces can be nested. For example, you can have a `users` namespace, and then a `users:admins`. `clear` methods will still only clear the current namespace.
- When interacting with the "root" BentoCache instance, you can still access the keys that were set via a namespace. For example, you can still access the `users:1` key via `bento.get({ key: 'users:1' })`.
