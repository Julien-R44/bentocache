---
'bentocache': patch
---

Detect an existing ioredis connection by shape instead of `instanceof`

`RedisDriver` and `redisBusDriver` decided whether `connection` was a live client or a plain options object with `connection instanceof IoRedis || connection instanceof IoRedisCluster`. That check is evaluated against the `ioredis` copy **bentocache** resolved, so it returns `false` for a perfectly valid client whenever the host application resolved a different `ioredis` major. The driver then fell through to `new IoRedis(<a live client>)`, ioredis ignored the unrecognised properties and silently connected to `127.0.0.1:6379`.

Both call sites now duck-type on `duplicate` / `sendCommand`, which are present on `Redis` and `Cluster` in every ioredis major and are not valid option names. A value that looks like a client but is not recognisable now throws instead of silently building a connection to localhost.
