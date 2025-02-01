import { is } from '@julr/utils/is'
import lodash from '@poppinss/utils/lodash'

import { Bus } from '../../bus/bus.js'
import { UndefinedValueError } from '../../errors.js'
import { LocalCache } from '../facades/local_cache.js'
import { RemoteCache } from '../facades/remote_cache.js'
import { BaseDriver } from '../../drivers/base_driver.js'
import { CacheWritten } from '../../events/cache/cache_written.js'
import type { BentoCacheOptions } from '../../bento_cache_options.js'
import { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'
import {
  type BusDriver,
  type BusOptions,
  type CacheEvent,
  type CacheStackDrivers,
  type CacheBusMessage,
  type Logger,
  CacheBusMessageType,
} from '../../types/main.js'

export class CacheStack extends BaseDriver {
  l1?: LocalCache
  l2?: RemoteCache
  bus?: Bus
  defaultOptions: CacheEntryOptions
  logger: Logger
  #busDriver?: BusDriver
  #busOptions?: BusOptions
  #namespaceCache: Map<string, CacheStack> = new Map()

  constructor(
    public name: string,
    public options: BentoCacheOptions,
    drivers: CacheStackDrivers,
    bus?: Bus,
  ) {
    super(options)
    this.logger = options.logger.child({ cache: this.name })

    if (drivers.l1Driver)
      this.l1 = new LocalCache(drivers.l1Driver, this.logger, this.options.serializer)
    if (drivers.l2Driver)
      this.l2 = new RemoteCache(drivers.l2Driver, this.logger, this.options.serializer)

    this.bus = bus ? bus : this.#createBus(drivers.busDriver, drivers.busOptions)
    if (this.l1) this.bus?.manageCache(this.prefix, this.l1)

    this.defaultOptions = new CacheEntryOptions(options)
  }

  get emitter() {
    return this.options.emitter
  }

  #createBus(busDriver?: BusDriver, busOptions?: BusOptions) {
    if (!busDriver) return

    this.#busDriver = busDriver
    this.#busOptions = lodash.merge(
      { retryQueue: { enabled: true, maxSize: undefined } },
      busOptions,
    )
    const newBus = new Bus(this.name, this.#busDriver, this.logger, this.emitter, this.#busOptions)

    return newBus
  }

  namespace(namespace: string): CacheStack {
    if (!this.#namespaceCache.has(namespace)) {
      this.#namespaceCache.set(
        namespace,
        new CacheStack(
          this.name,
          this.options.cloneWith({ prefix: this.createNamespacePrefix(namespace) }),
          {
            l1Driver: this.l1?.namespace(namespace),
            l2Driver: this.l2?.namespace(namespace),
          },
          this.bus,
        ),
      )
    }

    return <CacheStack>this.#namespaceCache.get(namespace)
  }

  /**
   * Publish a message to the bus channel
   *
   * @returns true if the message was published, false if not
   * and undefined if a bus is not part of the stack
   */
  async publish(message: CacheBusMessage): Promise<boolean | undefined> {
    return this.bus?.publish({ ...message, namespace: this.prefix })
  }

  emit(event: CacheEvent) {
    return this.emitter.emit(event.name, event.toJSON())
  }

  serialize(value: any) {
    return this.options.serializer.serialize(value)
  }

  deserialize(value: string) {
    return this.options.serializer.deserialize(value)
  }

  /**
   * Write a value in the cache stack
   * - Set value in local cache
   * - Set value in remote cache
   * - Publish a message to the bus
   * - Emit a CacheWritten event
   */
  async set(key: string, value: any, options: CacheEntryOptions) {
    if (is.undefined(value)) throw new UndefinedValueError(key)

    const item = this.serialize({
      value,
      logicalExpiration: options.logicalTtlFromNow(),
    })

    this.l1?.set(key, item, options)
    await this.l2?.set(key, item, options)
    await this.publish({ type: CacheBusMessageType.Set, keys: [key] })

    this.emit(new CacheWritten(key, value, this.name))
    return true
  }
}
