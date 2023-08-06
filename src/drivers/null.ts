import type { CacheDriver } from '../types/driver.js'
import type { KeyValueObject } from '../types/helpers.js'
import { BaseDriver } from './base_driver.js'

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

  getMany(_keys: string[]) {
    return []
  }

  pull(_key: string) {
    return undefined
  }

  set(_key: string, _value: string, _ttl?: number | undefined) {
    return true
  }

  setMany(_values: KeyValueObject[], _ttl?: number | undefined) {
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
