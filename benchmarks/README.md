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

## Global results

`all.ts` file.

```sh
┌─────────┬──────────────────────────────────┬─────────────────────┬───────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name                        │ Latency avg (ns)    │ Latency med (ns)  │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼──────────────────────────────────┼─────────────────────┼───────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'L1 GetOrSet - BentoCache'       │ '3724.7 ± 98.52%'   │ '417.00 ± 42.00'  │ '2293951 ± 0.06%'      │ '2398082 ± 268585'     │ 371127  │
│ 1       │ 'L1 GetOrSet - CacheManager'     │ '588266 ± 111.26%'  │ '106646 ± 8041.5' │ '8992 ± 0.82%'         │ '9377 ± 712'           │ 1700    │
│ 2       │ 'L2 GetOrSet - BentoCache'       │ '508923 ± 111.69%'  │ '76834 ± 8709.0'  │ '11732 ± 1.28%'        │ '13015 ± 1566'         │ 1965    │
│ 3       │ 'L2 GetOrSet - CacheManager'     │ '2066351 ± 111.75%' │ '249813 ± 50292'  │ '3582 ± 3.60%'         │ '4003 ± 932'           │ 484     │
│ 4       │ 'Tiered GetOrSet - BentoCache'   │ '4159.6 ± 98.74%'   │ '458.00 ± 42.00'  │ '2110863 ± 0.07%'      │ '2183406 ± 220440'     │ 332932  │
│ 5       │ 'Tiered GetOrSet - CacheManager' │ '821765 ± 111.92%'  │ '124792 ± 19667'  │ '7302 ± 1.66%'         │ '8013 ± 1417'          │ 1217    │
│ 6       │ 'Tiered Get - BentoCache'        │ '317.34 ± 0.31%'    │ '292.00 ± 1.00'   │ '3333262 ± 0.01%'      │ '3424658 ± 11769'      │ 3151168 │
│ 7       │ 'Tiered Get - CacheManager'      │ '1094.4 ± 0.38%'    │ '1083.0 ± 42.00'  │ '927685 ± 0.01%'       │ '923361 ± 36332'       │ 913713  │
│ 8       │ 'Tiered Set - BentoCache'        │ '57234 ± 0.42%'     │ '55833 ± 1751.0'  │ '17814 ± 0.13%'        │ '17911 ± 565'          │ 17473   │
│ 9       │ 'Tiered Set - CacheManager'      │ '68898 ± 0.96%'     │ '67292 ± 2625.0'  │ '14713 ± 0.12%'        │ '14861 ± 583'          │ 14515   │
└─────────┴──────────────────────────────────┴─────────────────────┴───────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

Please if you see any mistake in the benchmarks, open an issue and I will correct it.

- Run: 04/21/2025
- Node 22.14.0
- Mac Mini M1, 16GB RAM
