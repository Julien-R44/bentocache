---
'bentocache': minor
---

Added a super simple circuit breaker system to the L2 Cache : 
- a `l2CircuitBreakerDuration` parameter to set the duration of the circuit breaker. How many seconds the circuit breaker will stay open.
- If defined, the circuit breaker will open when a call to our distributed cache fails. It will stay open for `l2CircuitBreakerDuration` seconds. 

We may introduce more sophisticated circuit breaker system in the future, but for now, this simple system should be enough.
