import { Mutex, withTimeout, type MutexInterface } from 'async-mutex'

export class Locks {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Map<string, MutexInterface>()

  /**
   * For a given key, get or create a new lock
   *
   * @param timeout Time to wait to acquire the lock
   */
  getOrCreateForKey(key: string, timeout?: number) {
    let lock = this.#locks.get(key)
    if (!lock) {
      lock = new Mutex()
      this.#locks.set(key, lock)
    }

    return timeout ? withTimeout(lock, timeout) : lock
  }

  /**
   * Remove a lock from the map
   */
  delete(key: string) {
    this.#locks.delete(key)
  }
}
