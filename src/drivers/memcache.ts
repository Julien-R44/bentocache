import KeyvMemcache from "@keyv/memcache"
import Keyv from "keyv"
import { CacheDriverContract, MemcacheConfig } from "../types/main.js"
import { KeyvDriver } from "./keyv_driver.js"
import { Client } from 'memjs'

/**
 * Works with Memcached, Memcachier, Redislabs and Google cloud
 */
export class Memcache extends KeyvDriver implements CacheDriverContract {
  declare store: KeyvMemcache

  constructor(config: MemcacheConfig) {
    super()
    this.#createStore(config)
  }

  #createStore(config: MemcacheConfig) {
    this.store = new KeyvMemcache('localhost:11211')
    this.keyv = new Keyv({ store: this.store, ttl: config.ttl })
  }

  #getMemcacheClient() {
    return this.store.client as Client
  }

  async increment(key: string, value?: number): Promise<number> {
    const { value: result } = await this.#getMemcacheClient().increment(key, value || 1)
    return result || value || 1
  }

  async decrement(key: string, value?: number): Promise<number> {
    const { value: result } = await this.#getMemcacheClient().decrement(key, value || 1)
    return result || value || 1
  }

  async disconnect() {
    this.#getMemcacheClient().quit()
  }
}
