import { hexoid } from 'hexoid'
import { is } from '@julr/utils/is'

import { errors } from '../../errors.js'
import { resolveTtl } from '../../helpers.js'
import type { Duration, RawCommonOptions, ValidateOption } from '../../types/main.js'

const toId = hexoid(12)

export type CacheEntryOptions = ReturnType<typeof createCacheEntryOptions>

/**
 * Resolve the grace options
 */
function resolveGrace(options: RawCommonOptions) {
  if (options.grace === false) return 0

  return resolveTtl(options.grace, null) ?? 0
}

/**
 * Resolve validator
 */
function resolveValidate(options: RawCommonOptions & ValidateOption) {
  const validate = options.validate
  if (!validate) return (value: unknown) => value

  if (typeof validate === 'function') {
    return (value: unknown) => {
      try {
        validate(value)
      } catch (error) {
        throw new errors.E_VALIDATION_ERROR(error, { cause: error })
      }

      return value
    }
  }

  if (validate && '~standard' in validate) {
    return (value: unknown) => {
      const result = validate['~standard'].validate(value)
      if (result instanceof Promise) throw new TypeError('Validation must be synchronous')
      if (result.issues) throw new errors.E_VALIDATION_ERROR(result.issues)

      return result.value
    }
  }

  return () => true
}

/**
 * Cache Entry Options. Define how a cache operation should behave
 *
 * Yes, this is a fake class. Initially, this was a class, but
 * since CacheEntryOptions is initialized each time a cache
 * operation is performed, it was converted to this
 * fake class to have way better performance.
 */
export function createCacheEntryOptions(
  newOptions: RawCommonOptions & ValidateOption = {},
  defaults: Partial<RawCommonOptions> = {},
) {
  const options = { ...defaults, ...newOptions }

  const grace = resolveGrace(options)
  const graceBackoff = resolveTtl(options.graceBackoff, null) ?? 0

  let logicalTtl = resolveTtl(options.ttl)
  let physicalTtl = grace > 0 ? grace : logicalTtl

  const timeout = resolveTtl(options.timeout, null)
  const hardTimeout = resolveTtl(options.hardTimeout, null)
  const lockTimeout = resolveTtl(options.lockTimeout, null)

  const self = {
    /**
     * Unique identifier that will be used when logging
     * debug information.
     */
    id: toId(),

    /**
     * Resolved grace period options
     */
    grace,
    graceBackoff,

    /**
     * Logical TTL is when the value is considered expired
     * but still can be in the cache ( Grace period )
     */
    get logicalTtl() {
      return logicalTtl
    },

    /**
     * Physical TTL is the time when value will be automatically
     * removed from the cache. This is the Grace period
     * duration
     */
    get physicalTtl() {
      return physicalTtl
    },

    /**
     * Determine if the gracing system is enabled
     */
    get isGraceEnabled() {
      return grace > 0
    },

    /**
     * Timeouts for the cache operations
     */
    timeout,
    hardTimeout,

    /**
     * Max time to wait for the lock to be acquired
     */
    lockTimeout,
    onFactoryError: options.onFactoryError ?? defaults.onFactoryError,
    suppressL2Errors: options.suppressL2Errors,
    validate: resolveValidate(options),

    /**
     * Returns a new instance of `CacheItemOptions` with the same
     * options as the current instance, but with any provided
     * options overriding the current
     *
     * For performance reasons, if no options are provided, the
     * current instance is returned
     */
    cloneWith(newOptions?: Partial<RawCommonOptions>) {
      return newOptions ? createCacheEntryOptions(newOptions, options) : self
    },

    /**
     * Set a new logical TTL
     */
    setLogicalTtl(newTtl: Duration) {
      options.ttl = newTtl

      logicalTtl = resolveTtl(options.ttl)
      physicalTtl = self.isGraceEnabled ? grace : logicalTtl

      return self
    },

    /**
     * Compute the logical TTL timestamp from now
     */
    logicalTtlFromNow() {
      if (!logicalTtl) return

      return Date.now() + logicalTtl
    },

    /**
     * Compute the physical TTL timestamp from now
     */
    physicalTtlFromNow() {
      if (!physicalTtl) return

      return Date.now() + physicalTtl
    },

    /**
     * Compute the lock timeout we should use for the
     * factory
     */
    factoryTimeout(hasFallbackValue: boolean) {
      if (hasFallbackValue && self.isGraceEnabled && is.number(timeout)) {
        return { type: 'soft', duration: timeout, exception: errors.E_FACTORY_SOFT_TIMEOUT }
      }

      if (hardTimeout) {
        return { type: 'hard', duration: hardTimeout, exception: errors.E_FACTORY_HARD_TIMEOUT }
      }
    },

    /**
     * Determine if we should use the SWR strategy
     */
    shouldSwr(hasFallback: boolean) {
      return self.isGraceEnabled && timeout === 0 && hasFallback
    },

    /**
     * Compute the maximum time we should wait for the
     * lock to be acquired
     */
    getApplicableLockTimeout(hasFallbackValue: boolean) {
      if (lockTimeout) return lockTimeout

      /**
       * If we have a fallback value and grace period is enabled,
       * that means we should wait at most for the soft timeout
       * duration.
       */
      if (hasFallbackValue && self.isGraceEnabled && typeof timeout === 'number') {
        return timeout
      }
    },
  }

  return self
}
