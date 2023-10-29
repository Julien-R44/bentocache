import { Exception } from '@poppinss/utils'

export class FactorySoftTimeout extends Exception {
  static code = 'E_FACTORY_SOFT_TIMEOUT'
  static status = 500
  static message = 'Factory has timed out after waiting for soft timeout'
}

export class FactoryHardTimeout extends Exception {
  static code = 'E_FACTORY_HARD_TIMEOUT'
  static status = 500
  static message = 'Factory has timed out after waiting for hard timeout'
}
