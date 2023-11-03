import type { RedisOptions as IoRedisOptions } from 'ioredis'

import { Redis } from '../src/drivers/redis.js'
import { RedisBus } from '../src/bus/drivers/redis_bus.js'
import type { RedisConfig } from '../src/types/options/drivers_options.js'
import type { BusOptions, CreateBusDriverResult, CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new cache redis driver
 */
export function redisDriver(options: RedisConfig): CreateDriverResult<Redis> {
  return {
    options,
    factory: (config: RedisConfig) => new Redis(config),
  }
}

/**
 * Create a new bus redis driver. It leverages the Pub/sub capabilities of Redis
 * to sending messages between your different processes.
 */
export function redisBusDriver(
  options: { connection: IoRedisOptions } & BusOptions
): CreateBusDriverResult {
  return { options, factory: (config: IoRedisOptions) => new RedisBus(config) }
}
