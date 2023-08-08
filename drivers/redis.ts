import { Redis } from '../src/drivers/redis.js'
import type { RedisConfig } from '../src/types/options.js'
import { RedisBus } from '../src/bus/drivers/redis_bus.js'
import type { CreateBusDriverResult, CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new cache redis driver
 */
export function redisDriver(options: RedisConfig): CreateDriverResult {
  return { local: { options, factory: (config: RedisConfig) => new Redis(config) } }
}

/**
 * Create a new bus redis driver
 */
export function redisBusDriver(
  options: ConstructorParameters<typeof RedisBus>[0]
): CreateBusDriverResult {
  return {
    options,
    factory: (config: ConstructorParameters<typeof RedisBus>[0]) => new RedisBus(config),
  }
}
