---
summary: The events emitted by Bentocache throughout its execution
---

# Events

Throughout its execution, Bentocache emits different events that can be listened to and received on your end. This allows you to do a lot of things, but mainly for monitoring purposes. Imagine a small Grafana dashboard backed by Prometheus that allows you to see the real-time status and behavior of your cache. Wouldn't that be nice?

## Listening to Events

You simply need to use the `on` method of the Bentocache instance to listen to events.

```ts
bento.on('cache:hit', ({ key, value, store }) => {
  console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
})
```

There is also the `once` method that allows you to listen to an event only once.

```ts
bento.once('cache:hit', ({ key, value, store }) => {
  console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
})
```

And finally, the `off` method that allows you to remove a listener.

```ts
const listener = ({ key, value, store }) => {
  console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
}

bento.on('cache:hit', listener)
bento.off('cache:hit', listener)
```

## Using Your Own Emitter

If you already have an event emitter in your application, you can pass it to Bentocache so that it uses it instead of its own emitter.

```ts
const emitter = new EventEmitter()
const bento = new BentoCache({
  // highlight-start
  emitter,
  // highlight-end
  default: 'memory',
  stores: {
    memory: bentostore().useL1Layer(memoryDriver()),
  },
})
```

You can also use an emitter that is not an EventEmitter, as long as it implements the `Emitter` interface:

```ts
export interface Emitter {
  on: (event: string, cb: (...values: any[]) => void) => void
  once: (event: string, cb: (...values: any[]) => void) => void
  off: (event: string, cb: (...values: any[]) => void) => void
  emit: (event: string, ...values: any[]) => void
}
```

[Emittery](https://github.com/sindresorhus/emittery) is notably a good alternative to Node.js's `EventEmitter` that is compatible with this interface.


## List of Events

### `cache:hit`

Emitted when a key is found in the cache. 

Payload: `{ key, value, store, graced }`

- `key`: The key that was found in the cache
- `value`: The value that was found in the cache
- `store`: The name of the store that was used to retrieve the value
- `graced`: `true` when the value was retrieved from a grace period
---

### `cache:miss`

Emitted when a key is not found in the cache. 

Payload: `{ key, store }`

- `key`: The key that was not found in the cache
- `store`: The name of the store that was used to retrieve the value
---

### `cache:written`

Emitted when a key is written to the cache. 

Payload: `{ key, value, store }`

- `key`: The key that was written to the cache
- `value`: The value that was written to the cache
---

### `cache:deleted`

Emitted when the key is removed from the cache. 

Payload: `{ key, store }`

- `key`: The key that was removed from the cache
- `store`: The name of the store that was used to remove the value
---

### `cache:cleared`

Emitted when the cache is emptied. 

Payload: `{ store }`

- `store`: The name of the store that was emptied
---

### `bus:message:published`

Emitted when the bus publishes a message to other applications. 

Payload: `{ message }`

- `message`: The message that was published
---

### `bus:message:received`

Emitted when the application receives a message instructing it to update its cache. 

Payload: `{ message }`

- `message`: The message that was received
