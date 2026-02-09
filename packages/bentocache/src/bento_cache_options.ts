import EventEmitter from 'node:events'
import { ms } from '@julr/utils/string/ms'
import { noopLogger } from '@julr/utils/logger'

import { Logger } from './logger.js'
import { resolveTtl } from './helpers.js'
import type { FactoryError } from './errors.js'
import { JsonSerializer } from './serializers/json.js'
import type { CacheSerializer, Duration, Emitter, RawBentoCacheOptions } from './types/main.js'

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
  ttl: Duration = ms.parse('30m')

  /**
   * Default prefix for all caches
   */
  prefix: string = 'bentocache'

  /**
   * The grace period options
   */
  grace: Duration | false = false
  graceBackoff: Duration = ms.parse('10s')

  /**
   * Whether to suppress L2 cache errors
   */
  suppressL2Errors?: boolean

  /**
   * The soft and hard timeouts for the factories
   */
  timeout: Duration = 0
  hardTimeout?: Duration = null

  /**
   * The logger used throughout the library
   */
  logger: Logger

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

  /**
   * Duration for the circuit breaker to stay open
   * if l2 cache fails
   */
  l2CircuitBreakerDuration: number | undefined

  /**
   * If the L1 cache should be serialized
   */
  serializeL1: boolean = true
  onFactoryError?: (error: FactoryError) => void
  internalOperationWrapper?: RawBentoCacheOptions['internalOperationWrapper']

  constructor(options: RawBentoCacheOptions) {
    this.#options = { ...this, ...options }

    this.prefix = this.#options.prefix!
    this.ttl = this.#options.ttl!
    this.timeout = this.#options.timeout ?? 0
    this.hardTimeout = this.#options.hardTimeout
    this.suppressL2Errors = this.#options.suppressL2Errors
    this.lockTimeout = this.#options.lockTimeout
    this.grace = this.#options.grace!
    this.graceBackoff = this.#options.graceBackoff!

    this.emitter = this.#options.emitter!
    this.serializer = this.#options.serializer ?? defaultSerializer
    this.l2CircuitBreakerDuration = resolveTtl(this.#options.l2CircuitBreakerDuration, null)

    this.logger = new Logger(this.#options.logger ?? noopLogger())
    this.onFactoryError = this.#options.onFactoryError
    this.internalOperationWrapper = this.#options.internalOperationWrapper
  }

  serializeL1Cache(shouldSerialize: boolean = true) {
    this.serializeL1 = shouldSerialize
    return this
  }

  cloneWith(options: RawBentoCacheOptions) {
    const newOptions = { ...this.#options, ...options }
    return new BentoCacheOptions(newOptions)
  }
}
