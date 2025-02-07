---
'bentocache': minor
---

Added a `serialize: false` to the memory driver. 

It means that, the data stored in the memory cache will not be serialized/parsed using `JSON.stringify` and `JSON.parse`. This allows for a much faster throughput but at the expense of:
- not being able to limit the size of the stored data, because we can't really know the size of an unserialized object
- Having inconsistent return between the L1 and L2 cache. The data stored in the L2 Cache will always be serialized because it passes over the network. Therefore, depending on whether the data is retrieved from the L1 and L2, we can have data that does not have the same form. For example, a Date instance will become a string if retrieved from the L2, but will remain a Date instance if retrieved from the L1. So, you should put extra care when using this feature with an additional L2 cache.

