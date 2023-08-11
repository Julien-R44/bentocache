import { createId } from '@paralleldrive/cuid2'
import type { RedisOptions as IoRedisOptions } from 'ioredis'

import { Redis } from '../src/drivers/redis.js'
import type { RedisConfig } from '../src/types/options.js'
import { RedisBus } from '../src/bus/drivers/redis_bus.js'
import type { BusOptions, CreateBusDriverResult, CreateDriverResult } from '../src/types/main.js'

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
  options: { connection: IoRedisOptions } & BusOptions
): CreateBusDriverResult {
  return { options, factory: (config: IoRedisOptions) => new RedisBus(createId(), config) }
}
