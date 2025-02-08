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
┌─────────┬──────────────────────────────────┬─────────────────────┬─────────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name                        │ Latency avg (ns)    │ Latency med (ns)    │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼──────────────────────────────────┼─────────────────────┼─────────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'L1 GetOrSet - BentoCache'       │ '9610.3 ± 98.26%'   │ '1109.0 ± 29.00'    │ '879036 ± 0.05%'       │ '901713 ± 22979'       │ 143980  │
│ 1       │ 'L1 GetOrSet - CacheManager'     │ '906687 ± 110.96%'  │ '172470 ± 1785.00'  │ '5601 ± 0.56%'         │ '5798 ± 61'            │ 1103    │
│ 2       │ 'L2 GetOrSet - BentoCache'       │ '2891294 ± 111.70%' │ '550103 ± 21732.50' │ '1770 ± 1.18%'         │ '1818 ± 73'            │ 346     │
│ 3       │ 'L2 GetOrSet - CacheManager'     │ '3746073 ± 111.65%' │ '707329 ± 20335.00' │ '1378 ± 1.45%'         │ '1414 ± 42'            │ 267     │
│ 4       │ 'Tiered GetOrSet - BentoCache'   │ '8752.8 ± 98.40%'   │ '1060.0 ± 19.00'    │ '924367 ± 0.04%'       │ '943396 ± 17219'       │ 158461  │
│ 5       │ 'Tiered GetOrSet - CacheManager' │ '925163 ± 111.45%'  │ '173578 ± 2970.00'  │ '5590 ± 0.55%'         │ '5761 ± 100'           │ 1081    │
│ 6       │ 'Tiered Get - BentoCache'        │ '556.57 ± 0.52%'    │ '511.00 ± 10.00'    │ '1923598 ± 0.01%'      │ '1956947 ± 37561'      │ 1796720 │
│ 7       │ 'Tiered Get - CacheManager'      │ '2060.2 ± 2.54%'    │ '1928.0 ± 20.00'    │ '513068 ± 0.02%'       │ '518672 ± 5325'        │ 485387  │
│ 8       │ 'Tiered Set - BentoCache'        │ '479721 ± 0.38%'    │ '472997 ± 11113.00' │ '2095 ± 0.26%'         │ '2114 ± 50'            │ 2085    │
│ 9       │ 'Tiered Set - CacheManager'      │ '459758 ± 0.30%'    │ '452934 ± 11205.00' │ '2183 ± 0.23%'         │ '2208 ± 55'            │ 2176    │
└─────────┴──────────────────────────────────┴─────────────────────┴─────────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

Please if you see any mistake in the benchmarks, open an issue and I will correct it.

- Run: 02/02/2025
- Node 22.11.0
- WSL2, Ubuntu 24.04, 32G RAM, 8 cores
