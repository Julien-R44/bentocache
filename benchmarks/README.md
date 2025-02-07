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
│ 0       │ 'L1 GetOrSet - BentoCache'       │ '16613 ± 97.87%'    │ '1560.0 ± 45.00'    │ '613098 ± 0.10%'       │ '641026 ± 19040'       │ 83796   │
│ 1       │ 'L1 GetOrSet - CacheManager'     │ '953451 ± 111.03%'  │ '160022 ± 3815.00'  │ '5700 ± 1.23%'         │ '6249 ± 151'           │ 1049    │
│ 2       │ 'L2 GetOrSet - BentoCache'       │ '2660684 ± 111.50%' │ '511258 ± 18657.00' │ '1913 ± 1.11%'         │ '1956 ± 73'            │ 376     │
│ 3       │ 'L2 GetOrSet - CacheManager'     │ '3425710 ± 111.41%' │ '663346 ± 25252.50' │ '1475 ± 1.32%'         │ '1508 ± 59'            │ 292     │
│ 4       │ 'Tiered GetOrSet - BentoCache'   │ '16105 ± 98.11%'    │ '1515.0 ± 45.00'    │ '636621 ± 0.08%'       │ '660066 ± 20206'       │ 86675   │
│ 5       │ 'Tiered GetOrSet - CacheManager' │ '877297 ± 111.36%'  │ '161617 ± 2876.00'  │ '5948 ± 0.67%'         │ '6187 ± 112'           │ 1140    │
│ 6       │ 'Tiered Get - BentoCache'        │ '1542.4 ± 4.43%'    │ '992.00 ± 18.00'    │ '973931 ± 0.03%'       │ '1008065 ± 17966'      │ 648343  │
│ 7       │ 'Tiered Get - CacheManager'      │ '1957.6 ± 0.51%'    │ '1848.0 ± 26.00'    │ '534458 ± 0.02%'       │ '541126 ± 7722'        │ 510827  │
│ 8       │ 'Tiered Set - BentoCache'        │ '448755 ± 0.39%'    │ '440138 ± 14165.00' │ '2242 ± 0.29%'         │ '2272 ± 74'            │ 2229    │
│ 9       │ 'Tiered Set - CacheManager'      │ '436970 ± 0.50%'    │ '429116 ± 13100.00' │ '2305 ± 0.29%'         │ '2330 ± 72'            │ 2289    │
└─────────┴──────────────────────────────────┴─────────────────────┴─────────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

Please if you see any mistake in the benchmarks, open an issue and I will correct it.

- Run: 02/02/2025
- Node 22.11.0
- WSL2, Ubuntu 24.04, 32G RAM, 8 cores
