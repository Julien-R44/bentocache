---
'bentocache': minor
---

Add **experimental** tagging support. See https://github.com/Julien-R44/bentocache/issues/53

```ts
await bento.getOrSet({
  key: 'foo',
  factory: getFromDb(),
  tags: ['tag-1', 'tag-2']
});

await bento.set({ 
  key: 'foo',
  tags: ['tag-1']
});
```

Then, we can delete all entries tagged with tag-1 using:

```ts
await bento.deleteByTags({ tags: ['tag-1'] });
```

As this is a rather complex feature, let's consider it experimental for now. Please report any bugs on Github issues
