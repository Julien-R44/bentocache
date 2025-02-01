---
'bentocache': minor
---

Keep only POJO syntax

This commit remove the "legacy" syntax and only keep the POJO syntax.
For each method, the method signature is a full object, for example : 

```ts
bento.get({ key: 'foo '})
bento.getOrSet({
  key: 'foo',
  factory: () => getFromDb()
})
```
