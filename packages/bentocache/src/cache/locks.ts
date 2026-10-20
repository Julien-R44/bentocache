import { is } from '@julr/utils/is'
import { Mutex, withTimeout } from 'async-mutex'

import type { LockHandle, LockManager, LockReleaser } from '../types/main.js'

export class Locks implements LockManager {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Map<string, LockHandle>()

  /**
   * For a given key, get or create a new lock
   *
   * @param key Key to get or create a lock for
   * @param timeout Time to wait to acquire the lock
   */
  getOrCreateForKey(key: string, timeout?: number): LockHandle {
    let lock = this.#locks.get(key)
    if (!lock) {
      lock = new Mutex()
      this.#locks.set(key, lock)
    }

    return is.number(timeout) ? withTimeout(lock, timeout) : lock
  }

  release(key: string, releaser: LockReleaser) {
    releaser()
    this.#locks.delete(key)
  }
}
