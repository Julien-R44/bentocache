import EventEmitter from 'node:events'
import lodash from '@poppinss/utils/lodash'
import string from '@poppinss/utils/string'
import { noopLogger } from 'typescript-log'

import { JsonSerializer } from './serializers/json.js'
import type {
  CacheSerializer,
  Duration,
  Emitter,
  FactoryTimeoutOptions,
  GracePeriodOptions as GracePeriodOptions,
  Logger,
  RawBentoCacheOptions,
} from './types/main.js'

const defaultSerializer = new JsonSerializer()

/**
 * The default options to use throughout the library
 *
 * Some of them can be override on a per-cache basis
 * or on a per-operation basis
 */
export class BentoCacheOptions {
  #options: RawBentoCacheOptions

  /**
   * The default TTL for all caches
   *
   * @default 30m
   */
  ttl: Duration = string.milliseconds.parse('30m')

  /**
   * Default prefix for all caches
   */
  prefix: string = 'bentocache'

  /**
   * The grace period options
   */
  gracePeriod: GracePeriodOptions = {
    enabled: false,
    duration: string.milliseconds.parse('6h'),
    fallbackDuration: string.milliseconds.parse('10s'),
  }

  /**
   * Default early expiration percentage
   */
  earlyExpiration: number = 0

  /**
   * Whether to suppress L2 cache errors
   */
  suppressL2Errors: boolean = true

  /**
   * The soft and hard timeouts for the factories
   */
  timeouts?: FactoryTimeoutOptions = {
    soft: null,
    hard: null,
  }

  /**
   * The logger used throughout the library
   */
  logger: Logger = noopLogger()

  /**
   * The emitter used throughout the library
   */
  emitter: Emitter = new EventEmitter()

  /**
   * Serializer to use for the cache
   */
  serializer: CacheSerializer

  /**
   * Max time to wait for the lock to be acquired
   */
  lockTimeout?: Duration = null

  constructor(options: RawBentoCacheOptions) {
    this.#options = lodash.merge({}, this, options)

    this.prefix = this.#options.prefix!
    this.ttl = this.#options.ttl!
    this.timeouts = this.#options.timeouts
    this.earlyExpiration = this.#options.earlyExpiration!
    this.suppressL2Errors = this.#options.suppressL2Errors!
    this.lockTimeout = this.#options.lockTimeout
    this.gracePeriod = this.#options.gracePeriod!

    this.emitter = this.#options.emitter!
    this.serializer = this.#options.serializer ?? defaultSerializer
    this.logger = this.#options.logger!.child({ pkg: 'bentocache' })
  }

  cloneWith(options: RawBentoCacheOptions) {
    const newOptions = lodash.merge({}, this.#options, options)
    return new BentoCacheOptions(newOptions)
  }
}
