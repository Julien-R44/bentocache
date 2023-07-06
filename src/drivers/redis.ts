import KeyvRedis from "@keyv/redis"
import Keyv from "keyv"
import { CacheDriverContract, RedisConfig } from "../types/main.js"
import { KeyvDriver } from "./keyv_driver.js"
import ioRedis from 'ioredis'

export class Redis extends KeyvDriver implements CacheDriverContract {
  declare store: KeyvRedis

  constructor(config: RedisConfig) {
    super()
    this.#createStore(config)
  }

  #createStore(_config: RedisConfig) {
    this.store = new KeyvRedis({ uri: 'redis://localhost:6379' })
    this.keyv = new Keyv({ store: this.store })
  }

  #getRedisClient()  {
    return this.store.redis as ioRedis.Redis
  }

  increment(key: string, value?: number): Promise<number> {
    return this.#getRedisClient().incrby(key, value || 1)
  }

  decrement(key: string, value?: number): Promise<number> {
    return this.#getRedisClient().decrby(key, value || 1)
  }
}
