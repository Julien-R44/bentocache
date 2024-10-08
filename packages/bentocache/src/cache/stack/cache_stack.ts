import lodash from '@poppinss/utils/lodash'

import { Bus } from '../../bus/bus.js'
import { LocalCache } from '../facades/local_cache.js'
import { RemoteCache } from '../facades/remote_cache.js'
import { JsonSerializer } from '../../serializers/json.js'
import type { BentoCacheOptions } from '../../bento_cache_options.js'
import { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'
import type {
  BusDriver,
  BusOptions,
  CacheEvent,
  CacheStackDrivers,
  Logger,
} from '../../types/main.js'

export class CacheStack {
  #serializer = new JsonSerializer()

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
    this.logger = options.logger.child({ cache: this.name })

    if (drivers.l1Driver) this.l1 = new LocalCache(drivers.l1Driver, this.logger)
    if (drivers.l2Driver) this.l2 = new RemoteCache(drivers.l2Driver, this.logger)

    this.bus = this.#createBus(drivers.busDriver, bus, drivers.busOptions)
    this.defaultOptions = new CacheEntryOptions(options)
  }

  get emitter() {
    return this.options.emitter
  }

  #createBus(busDriver?: BusDriver, bus?: Bus, busOptions?: BusOptions) {
    if (bus) return bus
    if (!busDriver || !this.l1) return

    this.#busDriver = busDriver
    this.#busOptions = lodash.merge(
      { retryQueue: { enabled: true, maxSize: undefined } },
      busOptions,
    )
    const newBus = new Bus(this.#busDriver, this.l1, this.logger, this.emitter, this.#busOptions)

    return newBus
  }

  namespace(namespace: string) {
    if (!this.#namespaceCache.has(namespace)) {
      this.#namespaceCache.set(
        namespace,
        new CacheStack(this.name, this.options, {
          l1Driver: this.l1?.namespace(namespace),
          l2Driver: this.l2?.namespace(namespace),
          busDriver: this.#busDriver,
          busOptions: { ...this.#busOptions, prefix: this.bus?.namespace(namespace) },
        }),
      )
    }

    return this.#namespaceCache.get(namespace)
  }

  emit(event: CacheEvent) {
    return this.emitter.emit(event.name, event.toJSON())
  }

  serialize(value: any) {
    return this.#serializer.serialize(value)
  }

  deserialize(value: string) {
    return this.#serializer.deserialize(value)
  }
}
