/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import is from '@sindresorhus/is'
import string from '@poppinss/utils/string'

import { JsonSerializer } from './serializers/json.js'
import type {
  CacheDriver,
  CacheEvent,
  CacheSerializer,
  CachedValue,
  Emitter,
  TTL,
} from './types/main.js'
import { CacheHit } from './events/cache_hit.js'
import { CacheDeleted } from './events/cache_deleted.js'
import { CacheMiss } from './events/cache_miss.js'
import { CacheWritten } from './events/cache_written.js'
import { CacheCleared } from './events/cache_cleared.js'
import { Mutex, MutexInterface, Semaphore, SemaphoreInterface, withTimeout } from 'async-mutex'

export class Cache {
  /**
   * Underlying driver
   */
  #driver: CacheDriver

  /**
   * Emitter to use when emitting cache:* events
   */
  #emitter?: Emitter

  /**
   * Serializer to use when storing and retrieving values
   */
  #serializer: CacheSerializer = new JsonSerializer()

  /**
   * Default TTL in milliseconds
   */
  #defaultTtl: number

  /**
   * Name of the cache store
   */
  #name: string

  /**
   * A map of locks to use for getOrSet cache stampede protection
   */
  #locks = new Map<string, Mutex>()

  constructor(
    name: string,
    driver: CacheDriver,
    options: {
      emitter?: { emit: (event: string, ...values: any[]) => void }
      ttl?: TTL
      serializer?: CacheSerializer
    }
  ) {
    this.#name = name
    this.#driver = driver
    this.#emitter = options.emitter
    this.#defaultTtl = this.#resolveTtl(options.ttl) ?? 1000 * 60 * 60
    this.#serializer = options.serializer ?? this.#serializer
  }

  /**
   * Resolve the given TTL to a number in milliseconds value
   */
  #resolveTtl(ttl?: TTL) {
    if (is.nullOrUndefined(ttl)) return this.#defaultTtl
    if (is.number(ttl)) return ttl

    return string.milliseconds.parse(ttl)
  }

  #resolveDefaultValue(defaultValue?: CachedValue | (() => CachedValue)) {
    return is.function_(defaultValue) ? defaultValue() : defaultValue ?? undefined
  }

  /**
   * Serialize a value
   */
  async #serialize(value: CachedValue) {
    return await this.#serializer.serialize(value)
  }

  /**
   * Deserialize a value
   */
  async #deserialize(value: string) {
    return await this.#serializer.deserialize(value)
  }

  /**
   * Emit a CacheEvent using the emitter
   */
  #emit(event: CacheEvent) {
    return this.#emitter?.emit(event.name, event.toJSON())
  }

  /**
   * Set a value in the cache
   */
  async #set<T extends CachedValue>(key: string, value: T, ttl?: number) {
    const serializedValue = await this.#serialize(value)
    const result = await this.#driver.set(key, serializedValue, ttl)
    if (result) {
      this.#emit(new CacheWritten(key, value, this.#name))
    }

    return result
  }

  /**
   * Get or create a new lock for the given key
   */
  #getOrCreateLock(key: string) {
    let lock = this.#locks.get(key)
    if (!lock) {
      lock = new Mutex()
      this.#locks.set(key, lock)
    }

    return lock
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Cache(this.#name, this.#driver.namespace(namespace), {
      emitter: this.#emitter,
      ttl: this.#defaultTtl,
      serializer: this.#serializer,
    })
  }

  /**
   * Get a value from the cache
   */
  async get(key: string, defaultValue?: CachedValue | (() => CachedValue)) {
    const value = await this.#driver.get(key)

    if (is.nullOrUndefined(value)) {
      this.#emit(new CacheMiss(key, this.#name))
      return this.#resolveDefaultValue(defaultValue)
    }

    const deserialized = await this.#deserialize(value)
    this.#emit(new CacheHit(key, deserialized, this.#name))

    return deserialized
  }

  /**
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  async getMany(
    keys: string[],
    defaultValues?: CachedValue[] | (() => CachedValue[]) | undefined
  ): Promise<{ key: string; value: CachedValue | undefined }[]> {
    const result = await this.#driver.getMany(keys)
    const resolvedDefaultValues = this.#resolveDefaultValue(defaultValues)

    const deserializedValuesPromises = keys.map(async (key, index) => {
      if (is.nullOrUndefined(result[index].value)) {
        this.#emit(new CacheMiss(key, this.#name))
        return { key, value: resolvedDefaultValues?.[index] }
      }

      const value = await this.#deserialize(result[index].value!)
      this.#emit(new CacheHit(key, value, this.#name))

      return { key, value }
    })

    return await Promise.all(deserializedValuesPromises)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set<T extends CachedValue>(key: string, value: T, ttl?: TTL) {
    return this.#set(key, value, this.#resolveTtl(ttl))
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever<T extends CachedValue>(key: string, value: T) {
    return this.#set(key, value)
  }

  /**
   * Set many values in the cache
   */
  async setMany(values: { key: string; value: CachedValue }[], ttl?: number) {
    const serializedValuesPromises = values.map(async (value) => ({
      key: value.key,
      value: await this.#serialize(value.value),
    }))

    const serializedValues = await Promise.all(serializedValuesPromises)

    const result = await this.#driver.setMany(serializedValues, this.#resolveTtl(ttl))
    if (result) {
      values.forEach((value) => this.#emit(new CacheWritten(value.key, value.value!, this.#name)))
    }

    return result
  }

  async #getOrSet(key: string, callback: () => Promise<CachedValue> | CachedValue, ttl?: number) {
    const value = await this.get(key)
    if (!is.nullOrUndefined(value)) {
      return value
    }

    /**
     * Here we know that the value is not in the cache.
     * So we have to call the callback to resolve the value.
     *
     * We acquire a in-memory lock to make sure that only one
     * request will call the callback. All other requests will
     * wait for the first one to finish and then return the value
     */
    let lock = this.#getOrCreateLock(key)
    const release = await lock.acquire()

    try {
      /**
       * We have to check again if the value is in the cache
       * since another request might have resolved it while
       * we were waiting for the lock
       */
      const doubleCheckedValue = await this.get(key)
      if (!is.nullOrUndefined(doubleCheckedValue)) {
        return doubleCheckedValue
      }

      const newValue = await callback()
      await this.#set(key, newValue, ttl)

      return newValue
    } finally {
      release()
      this.#locks.delete(key)
    }
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the callback and return it
   */
  async getOrSet(
    key: string,
    ttlOrCallback: TTL | (() => Promise<CachedValue> | CachedValue),
    callback?: () => Promise<CachedValue> | CachedValue
  ) {
    const ttl = is.function_(ttlOrCallback) ? this.#defaultTtl : this.#resolveTtl(ttlOrCallback)
    const resolvedCallback = is.function_(ttlOrCallback) ? ttlOrCallback : callback

    return this.#getOrSet(key, resolvedCallback!, ttl)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the callback forever and return it
   */
  async getOrSetForever(
    key: string,
    callback: () => CachedValue | Promise<CachedValue>
  ): Promise<CachedValue> {
    return this.#getOrSet(key, callback)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    return this.#driver.has(key)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(key: string) {
    const hasKey = await this.#driver.has(key)
    return !hasKey
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string) {
    const result = await this.#driver.pull(key)
    const returnValue = is.undefined(result) ? undefined : await this.#deserialize(result)

    if (result) {
      this.#emit(new CacheHit(key, returnValue, this.#name))
      this.#emit(new CacheDeleted(key, this.#name))
    }

    return returnValue
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    const result = await this.#driver.delete(key)

    if (result) {
      this.#emit(new CacheDeleted(key, this.#name))
    }

    return result
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]): Promise<boolean> {
    const result = await this.#driver.deleteMany(keys)
    if (result) {
      keys.forEach((key) => this.#emit(new CacheDeleted(key, this.#name)))
    }

    return result
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await this.#driver.clear()
    this.#emit(new CacheCleared(this.#name))
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    return this.#driver.disconnect()
  }
}
