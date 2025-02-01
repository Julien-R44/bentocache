import { is } from '@julr/utils/is'
import { Mutex, withTimeout, type MutexInterface } from 'async-mutex'

export class Locks {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Map<string, MutexInterface>()

  /**
   * For a given key, get or create a new lock
   *
   * @param key Key to get or create a lock for
   * @param timeout Time to wait to acquire the lock
   */
  getOrCreateForKey(key: string, timeout?: number) {
    let lock = this.#locks.get(key)
    if (!lock) {
      lock = new Mutex()
      this.#locks.set(key, lock)
    }

    return is.number(timeout) ? withTimeout(lock, timeout) : lock
  }

  release(key: string, releaser: MutexInterface.Releaser) {
    releaser()
    this.#locks.delete(key)
  }
}
