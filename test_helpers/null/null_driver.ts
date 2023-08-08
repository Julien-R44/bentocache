import type { CacheDriver } from '../../src/types/driver.js'
import { BaseDriver } from '../../src/drivers/base_driver.js'

/**
 * A dummy cache driver that does nothing
 */
export class NullDriver extends BaseDriver implements CacheDriver {
  constructor(_config: any) {
    super(_config)
  }

  namespace() {
    return this
  }

  get(_key: string) {
    return undefined
  }

  pull(_key: string) {
    return undefined
  }

  set(_key: string, _value: string, _ttl?: number | undefined) {
    return true
  }

  has(_key: string) {
    return false
  }

  clear() {
    return
  }

  delete(_key: string) {
    return true
  }

  deleteMany(_keys: string[]) {
    return true
  }

  disconnect() {
    return
  }
}
