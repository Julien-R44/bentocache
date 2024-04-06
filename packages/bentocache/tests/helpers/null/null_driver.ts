import type { CacheDriver } from '../../../src/types/driver.js'
import { BaseDriver } from '../../../src/drivers/base_driver.js'

/**
 * A dummy cache driver that does nothing
 */
export class NullDriver extends BaseDriver implements CacheDriver<false> {
  namespace(): any {
    return this
  }

  get(_key: string): any {
    return undefined
  }

  pull(_key: string): any {
    return undefined
  }

  set(_key: string, _value: string, _ttl?: number | undefined): any {
    return true
  }

  has(_key: string): any {
    return false
  }

  clear(): any {
    return
  }

  delete(_key: string): any {
    return true
  }

  deleteMany(_keys: string[]): any {
    return true
  }

  disconnect(): any {
    return
  }
}
