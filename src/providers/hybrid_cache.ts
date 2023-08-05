import type { Emitter, Factory, GetOrSetOptions, GracefulRetainOptions } from '../types/main.js'
import { BaseProvider } from './base_provider.js'
import type { CacheDriver } from '../types/driver.js'
import type { CacheProvider } from '../types/provider.js'
import type { TTL, MaybePromise, KeyValueObject } from '../types/helpers.js'

export class HybridCache extends BaseProvider implements CacheProvider {
  #local: CacheDriver
  #remote: CacheDriver

  constructor(
    name: string,
    options: {
      local: CacheDriver
      remote: CacheDriver
      emitter?: Emitter
      ttl?: TTL
      gracefulRetain: GracefulRetainOptions
    }
  ) {
    super(name, options)

    // this.#local = new
    // this.#remote = options.remote
  }

  setForever(key: string, value: string): Promise<boolean> {
    throw new Error('Method not implemented.')
  }
  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  async getOrSet(
    key: string,
    ttlOrCallback: TTL | (() => Factory),
    callbackOrOptions?: Factory | GetOrSetOptions,
    maybeOptions?: GetOrSetOptions
  ) {
    let { ttl, factory, options } = this.resolveGetSetOptions(
      ttlOrCallback,
      callbackOrOptions,
      maybeOptions
    )

    // return this.
  }

  getOrSetForever(key: string, cb: Factory, opts?: GetOrSetOptions | undefined): Promise<any> {
    throw new Error('Method not implemented.')
  }
  missing(key: string): Promise<boolean> {
    throw new Error('Method not implemented.')
  }
  namespace(namespace: string): CacheDriver {
    throw new Error('Method not implemented.')
  }
  get(key: string): MaybePromise<string | undefined> {
    throw new Error('Method not implemented.')
  }
  getMany(keys: string[]): MaybePromise<KeyValueObject[]> {
    throw new Error('Method not implemented.')
  }
  pull(key: string): MaybePromise<string | undefined> {
    throw new Error('Method not implemented.')
  }
  set(key: string, value: string, ttl?: number | undefined): MaybePromise<boolean> {
    throw new Error('Method not implemented.')
  }
  setMany(values: KeyValueObject[], ttl?: number | undefined): MaybePromise<boolean> {
    throw new Error('Method not implemented.')
  }
  has(key: string): MaybePromise<boolean> {
    throw new Error('Method not implemented.')
  }
  clear(): MaybePromise<void> {
    throw new Error('Method not implemented.')
  }
  delete(key: string): MaybePromise<boolean> {
    throw new Error('Method not implemented.')
  }
  deleteMany(keys: string[]): MaybePromise<boolean> {
    throw new Error('Method not implemented.')
  }
  disconnect(): MaybePromise<void> {
    throw new Error('Method not implemented.')
  }
}
