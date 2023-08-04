import type { Mutex } from 'async-mutex'
import { resolveTtl } from '../helpers.js'
import { JsonSerializer } from '../serializers/json.js'
import type { CacheDriver } from '../types/driver.js'
import type { TTL } from '../types/helpers.js'
import type { CacheEvent, CacheSerializer, Emitter, GracefulRetainOptions } from '../types/main.js'

export abstract class BaseProvider {
  protected emitter?: Emitter
  protected defaultTtl: number
  protected serializer: CacheSerializer = new JsonSerializer()
  protected gracefulRetain: GracefulRetainOptions

  protected locks = new Map<string, Mutex>()

  constructor(
    protected name: string,
    protected driver: CacheDriver,
    options: {
      emitter?: Emitter
      ttl?: TTL
      serializer?: CacheSerializer
      gracefulRetain: GracefulRetainOptions
    }
  ) {
    this.name = name
    this.driver = driver
    this.emitter = options.emitter
    // todo default ttl
    this.defaultTtl = resolveTtl(options.ttl, 1000 * 60 * 60)
    this.serializer = options.serializer ?? this.serializer
    this.gracefulRetain = options.gracefulRetain
  }

  /**
   * Emit a CacheEvent using the emitter
   */
  protected emit(event: CacheEvent) {
    return this.emitter?.emit(event.name, event.toJSON())
  }

  protected async serialize(value: any) {
    return await this.serializer.serialize(value)
  }

  protected async deserialize(value: string) {
    return await this.serializer.deserialize(value)
  }
}
