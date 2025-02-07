import { is } from '@julr/utils/is'
import { Exception } from '@poppinss/utils/exception'
import type { StandardSchemaV1 } from '@standard-schema/spec'

/**
 * Thrown when a factory has timed out after waiting for soft timeout
 */
export class FactorySoftTimeout extends Exception {
  static code = 'E_FACTORY_SOFT_TIMEOUT'
  static message = 'Factory has timed out after waiting for soft timeout'

  key: string

  constructor(key: string) {
    super(FactorySoftTimeout.message, { code: FactorySoftTimeout.code })

    this.key = key
  }
}

/**
 * Thrown when a factory has timed out after waiting for hard timeout
 */
export class FactoryHardTimeout extends Exception {
  static code = 'E_FACTORY_HARD_TIMEOUT'
  static message = 'Factory has timed out after waiting for hard timeout'

  key: string

  constructor(key: string) {
    super()

    this.key = key
  }
}

/**
 * Thrown when a factory has thrown an error. Original error is available as `cause`
 */
export class FactoryError extends Exception {
  static code = 'E_FACTORY_ERROR'
  static message = 'Factory has thrown an error'

  /**
   * The key for which the factory was called
   */
  key: string

  /**
   * If the error was thrown by a factory
   * running in the background
   */
  isBackgroundFactory: boolean

  constructor(key: string, cause: any, isBackground = false) {
    super(FactoryError.message, { cause })

    this.key = key
    this.isBackgroundFactory = isBackground
  }
}

/**
 * Thrown when a `undefined` value is about to be set
 * in the cache. You can't set `undefined` values.
 */
export class UndefinedValueError extends Exception {
  static code = 'E_UNDEFINED_VALUE'

  constructor(key: string) {
    super(`Cannot set undefined value in the cache, key: ${key}`)
  }
}

/**
 * Thrown when a validation fails
 */
export class ValidationError extends Exception {
  static code = 'E_VALIDATION_ERROR'

  #isStandardIssues(error: any): error is ReadonlyArray<StandardSchemaV1.Issue> {
    return is.array(error) && is.object(error[0]) && 'message' in error[0]
  }

  #formatStandardIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    return (
      '\n' + issues.map((issue) => `- ${issue.message} at "${issue.path?.join('.')}"`).join('\n')
    )
  }

  constructor(error: ReadonlyArray<StandardSchemaV1.Issue> | any, options?: ErrorOptions) {
    super()

    if (this.#isStandardIssues(error)) {
      this.message = this.#formatStandardIssues(error)
    } else {
      this.message = error
    }

    this.cause = options?.cause
  }
}

export const errors = {
  E_FACTORY_ERROR: FactoryError,
  E_FACTORY_SOFT_TIMEOUT: FactorySoftTimeout,
  E_FACTORY_HARD_TIMEOUT: FactoryHardTimeout,
  E_UNDEFINED_VALUE: UndefinedValueError,
  E_VALIDATION_ERROR: ValidationError,
}
