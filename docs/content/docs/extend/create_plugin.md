---
summary: Learn how to create a plugin for Bentocache
---

# Create a plugin

BentoCache allows you to register plugins to extend its functionalities. Creating a plugin is as simple as creating a function that returns an object with the `register` method : 

```ts
import type { BentoCachePlugin } from 'bentocache/types'

export function myBentoCachePlugin(): BentoCachePlugin {
  return {
     register(bentocache) {
        // And here you can do whatever you 
        // want with the bentocache instance
        bentocache.on('cache:miss', doSomething)
        bentocache.on('cache:hit', doSomething)
     }
   } 
}
```

The `register` method will be called internally by BentoCache when starting the application.

Then, you can register your plugin when creating the BentoCache instance : 

```ts
import { BentoCache } from 'bentocache'

const bentocache = new BentoCache({
  plugins: [myBentoCachePlugin()]
})
```

That's it! You can now create your own plugins and share them with the community.
