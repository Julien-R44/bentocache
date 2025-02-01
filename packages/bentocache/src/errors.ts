import { Exception } from '@poppinss/utils/exception'

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
    super(FactoryHardTimeout.message, { code: FactoryHardTimeout.code })

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
    super(FactoryError.message, { code: FactoryError.code, cause })

    this.key = key
    this.isBackgroundFactory = isBackground
  }
}

export const errors = {
  E_FACTORY_ERROR: FactoryError,
  E_FACTORY_SOFT_TIMEOUT: FactorySoftTimeout,
  E_FACTORY_HARD_TIMEOUT: FactoryHardTimeout,
}
