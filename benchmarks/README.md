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
│ 0       │ 'L1 GetOrSet - BentoCache'       │ '8210.2 ± 98.50%'   │ '941.00 ± 18.00'    │ '1029671 ± 0.06%'      │ '1062699 ± 20724'      │ 168254  │
│ 1       │ 'L1 GetOrSet - CacheManager'     │ '961548 ± 110.99%'  │ '175378 ± 5264.00'  │ '5428 ± 0.81%'         │ '5702 ± 176'           │ 1040    │
│ 2       │ 'L2 GetOrSet - BentoCache'       │ '2882820 ± 111.63%' │ '548453 ± 19261.00' │ '1770 ± 1.15%'         │ '1823 ± 64'            │ 347     │
│ 3       │ 'L2 GetOrSet - CacheManager'     │ '3547632 ± 111.55%' │ '687470 ± 17938.00' │ '1426 ± 1.21%'         │ '1455 ± 38'            │ 282     │
│ 4       │ 'Tiered GetOrSet - BentoCache'   │ '7922.9 ± 98.71%'   │ '932.00 ± 10.00'    │ '1049936 ± 0.05%'      │ '1072961 ± 11637'      │ 174603  │
│ 5       │ 'Tiered GetOrSet - CacheManager' │ '918338 ± 111.64%'  │ '170190 ± 2282.00'  │ '5678 ± 0.57%'         │ '5876 ± 80'            │ 1089    │
│ 6       │ 'Tiered Get - BentoCache'        │ '554.00 ± 0.47%'    │ '513.00 ± 10.00'    │ '1933949 ± 0.01%'      │ '1949318 ± 37272'      │ 1805048 │
│ 7       │ 'Tiered Get - CacheManager'      │ '2012.9 ± 1.80%'    │ '1882.0 ± 28.00'    │ '522571 ± 0.02%'       │ '531350 ± 7789'        │ 496805  │
│ 8       │ 'Tiered Set - BentoCache'        │ '466705 ± 0.31%'    │ '460615 ± 9501.00'  │ '2151 ± 0.24%'         │ '2171 ± 45'            │ 2143    │
│ 9       │ 'Tiered Set - CacheManager'      │ '463182 ± 0.39%'    │ '452347 ± 17086.00' │ '2174 ± 0.32%'         │ '2211 ± 84'            │ 2159    │
└─────────┴──────────────────────────────────┴─────────────────────┴─────────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

Please if you see any mistake in the benchmarks, open an issue and I will correct it.

- Run: 02/02/2025
- Node 22.11.0
- WSL2, Ubuntu 24.04, 32G RAM, 8 cores
