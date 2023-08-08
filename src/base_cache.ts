import type { Mutex } from 'async-mutex'
import { resolveTtl } from './helpers.js'
import { JsonSerializer } from './serializers/json.js'
import type { CachedValue, TTL } from './types/helpers.js'
import type {
  CacheEvent,
  CacheProviderOptions,
  CacheSerializer,
  Emitter,
  Factory as Factory,
  GetOrSetOptions,
  GracefulRetainOptions,
} from './types/main.js'
import { CacheItemOptions } from './cache_options.js'

export abstract class BaseProvider {
  protected emitter?: Emitter
  protected defaultTtl: number
  protected serializer: CacheSerializer = new JsonSerializer()
  protected gracefulRetain: GracefulRetainOptions
  protected earlyExpiration?: number
  protected defaultCacheOptions: CacheItemOptions

  protected locks = new Map<string, Mutex>()

  constructor(
    protected name: string,
    options: CacheProviderOptions
  ) {
    this.name = name
    this.emitter = options.emitter
    // todo default ttl
    this.defaultTtl = resolveTtl(options.ttl, 1000 * 60 * 60)
    this.serializer = options.serializer ?? this.serializer
    this.gracefulRetain = options.gracefulRetain
    this.earlyExpiration = options.earlyExpiration

    this.defaultCacheOptions = new CacheItemOptions({
      ttl: this.defaultTtl,
      gracefulRetain: this.gracefulRetain,
      earlyExpiration: this.earlyExpiration,
    })
  }

  /**
   * Emit a CacheEvent using the emitter
   */
  protected emit(event: CacheEvent) {
    return this.emitter?.emit(event.name, event.toJSON())
  }

  protected serialize(value: any) {
    return this.serializer.serialize(value)
  }

  protected deserialize(value: string) {
    return this.serializer.deserialize(value)
  }

  /**
   * Resolves the options for the `getOrSet` method
   * since it can be called in different ways
   */
  protected resolveGetSetOptions(
    ttlOrFactory: TTL | Factory,
    factoryOrOptions?: Factory | GetOrSetOptions,
    options?: GetOrSetOptions
  ) {
    let ttl: TTL
    let factory: Factory
    let resolvedOptions: GetOrSetOptions

    if (typeof ttlOrFactory === 'function') {
      ttl = this.defaultTtl
      factory = ttlOrFactory
      resolvedOptions = (factoryOrOptions as GetOrSetOptions) || options
    } else {
      ttl = resolveTtl(ttlOrFactory)
      factory = factoryOrOptions as () => Promise<CachedValue> | CachedValue
      resolvedOptions = options!
    }

    const cacheOptions = new CacheItemOptions(
      { ttl, ...resolvedOptions },
      {
        ttl: this.defaultTtl,
        gracefulRetain: this.gracefulRetain,
        earlyExpiration: this.earlyExpiration,
      }
    )

    return { ttl, factory, options: cacheOptions }
  }
}
