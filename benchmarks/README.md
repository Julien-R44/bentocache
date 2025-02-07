# Benchmarks

> [!IMPORTANT]  
> The benchmarks are not meant to be a definitive proof of which library is the best. They are mainly here to see if we make any performance regressions. And also for fun. Do not take them too seriously.

At the time of writing, every librairies seems on pair with each other when using a single tier cache. The real differences come when using a two-tier cache, only CacheManager and Bentocache support this feature. 

- `mtier_get_key` : Just get a key from the cache stack.

```
┌─────────┬────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name      │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'BentoCache'   │ '854.21 ± 0.75%' │ '776.00 ± 10.00' │ '1252083 ± 0.02%'      │ '1288660 ± 16823'      │ 1170677 │
│ 1       │ 'CacheManager' │ '1917.8 ± 2.90%' │ '1770.0 ± 27.00' │ '555669 ± 0.02%'       │ '564972 ± 8752'        │ 521437  │
└─────────┴────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

- `mtier_get_or_set` : Get a key from the cache stack, if it does not exist, set it. Here, we set a pretty big object in the cache.

```
┌─────────┬────────────────┬────────────────────┬────────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name      │ Latency avg (ns)   │ Latency med (ns)   │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼────────────────┼────────────────────┼────────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'BentoCache'   │ '191007 ± 97.41%'  │ '23818 ± 895.00'   │ '40318 ± 0.29%'        │ '41985 ± 1586'         │ 7342    │
│ 1       │ 'CacheManager' │ '945320 ± 111.53%' │ '171480 ± 3137.50' │ '5546 ± 0.76%'         │ '5832 ± 108'           │ 1058    │
└─────────┴────────────────┴────────────────────┴────────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

And, maybe not super-fair because `cache-manager` does not support it, but here is the same benchmark when not serializing the object in the memory cache in bentocache.

```
┌─────────┬────────────────┬─────────────────────┬────────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name      │ Latency avg (ns)    │ Latency med (ns)   │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼────────────────┼─────────────────────┼────────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'BentoCache'   │ '9612.9 ± 98.61%'   │ '1038.0 ± 38.00'   │ '925293 ± 0.07%'       │ '963391 ± 35610'       │ 144149  │
│ 1       │ 'CacheManager' │ '1006145 ± 111.82%' │ '173551 ± 5106.50' │ '5388 ± 1.03%'         │ '5762 ± 173'           │ 994     │
└─────────┴────────────────┴─────────────────────┴────────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

Please if you see any mistake in the benchmarks, open an issue and I will correct it.

- Run: 02/02/2025
- Node 22.11.0
- WSL2, Ubuntu 24.04, 32G RAM, 8 cores
