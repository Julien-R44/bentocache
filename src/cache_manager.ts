import { Cache } from "./cache.js";
import { CacheDriverFactory, CacheDriverContract, CachedValue } from "./types/main.js";

export class CacheManager<KnownCaches extends Record<string, CacheDriverFactory>>
  implements CacheDriverContract
{
  #config: {
    default?: keyof KnownCaches
    list: KnownCaches
  }

  constructor(config: { default?: keyof KnownCaches; list: KnownCaches }) {
    this.#config = config
  }

  use<Cache extends keyof KnownCaches>(cache?: Cache): CacheDriverContract {
    let cacheToUse: keyof KnownCaches | undefined = cache || this.#config.default

    if (!cacheToUse) {
      throw new Error('No cache driver selected')
    }

    const driverFactory = this.#config.list[cacheToUse]

    const cacheInstance = new Cache(driverFactory({}))
    return cacheInstance
  }

  put<T extends CachedValue>(key: string, value: T, ttl?: number): Promise<void> {
    return this.use().put(key, value, ttl)
  }

  get<T extends CachedValue>(key: string): Promise<T | null> {
    return this.use().get<T>(key)
  }

  disconnect(): Promise<void> {
    return this.use().disconnect()
  }

  has(key: string): Promise<boolean> {
    return this.use().has(key)
  }

  clear(): Promise<void> {
    return this.use().clear()
  }

  async disconnectAll() {
    await Promise.all(
      Object.keys(this.#config.list).map((cache) => this.use(cache).disconnect())
    )
  }
}
