---
summary: Learn how to create a custom bus driver for BentoCache
---

# Create a custom bus driver

BentoCache allows you to create your own bus driver and use it in your application.

You will need to create a class that implements the `BusDriver` interface that can be imported through `bentocache/types`.

```ts
export interface BusDriver {
  publish(channel: string, message: CacheBusMessage): Promise<void>
  subscribe(channel: string, handler: (message: CacheBusMessage) => void): Promise<void>
  unsubscribe(channel: string): Promise<void>
  disconnect(): Promise<void>
  onReconnect(callback: () => void): void
}
```

Feel free to take inspirations from the existing drivers to create your own driver.

## Methods 

### publish

This method will be called internally by BentoCache when you call some of the core methods.
First argument is the channel name, second argument is the message to publish. 

### subscribe

This method will be called at the initialization of BentoCache. Each time a message is published on the channel, the handler should be called with the message as argument.

### unsubscribe

As the name suggests, it should unsubscribe the handler from the channel.

### disconnect

It should disconnect from the bus.

### onReconnect

In case of a disconnection, the callback passed to this method should be called when the connection is re-established. It will allow BentoCache to process the [retry queue](../multi_tier.md#retry-queue-strategy)
