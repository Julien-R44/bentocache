---
'bentocache': minor
---

BREAKING CHANGES

## API Changes for timeouts

The timeout options have changed APIs: 
`{ soft: '200ms', hard: '2s' }`

Becomes: 

```ts
getOrSet({ timeout: '200ms', hardTimeout: '2s' })
```

You can now also use `0` for `timeout` which means that, if a stale value is available, then it will be returned immediately, and the factory will run in the background. SWR-like, in short.

## Default timeout

Now, the default timeout is `0`. As explained above, this enables the SWR-like behavior by default, which is a good default for most cases and what most people expect.
