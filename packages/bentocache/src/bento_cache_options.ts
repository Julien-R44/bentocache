import EventEmitter from 'node:events'
import lodash from '@poppinss/utils/lodash'
import string from '@poppinss/utils/string'
import { noopLogger } from '@julr/utils/logger'

import { JsonSerializer } from './serializers/json.js'
import type {
  CacheSerializer,
  Duration,
  Emitter,
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
  grace: Duration | false = false
  graceBackoff: Duration = string.milliseconds.parse('10s')

  /**
   * Whether to suppress L2 cache errors
   */
  suppressL2Errors: boolean = true

  /**
   * The soft and hard timeouts for the factories
   */
  timeout: Duration = 0
  hardTimeout?: Duration = null

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
    this.timeout = this.#options.timeout ?? 0
    this.hardTimeout = this.#options.hardTimeout
    this.suppressL2Errors = this.#options.suppressL2Errors!
    this.lockTimeout = this.#options.lockTimeout
    this.grace = this.#options.grace!
    this.graceBackoff = this.#options.graceBackoff!

    this.emitter = this.#options.emitter!
    this.serializer = this.#options.serializer ?? defaultSerializer
    this.logger = this.#options.logger!.child({ pkg: 'bentocache' })
  }

  cloneWith(options: RawBentoCacheOptions) {
    const newOptions = lodash.merge({}, this.#options, options)
    return new BentoCacheOptions(newOptions)
  }
}
