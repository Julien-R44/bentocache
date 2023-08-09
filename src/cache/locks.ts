import { Mutex, type MutexInterface } from 'async-mutex'

export class Locks {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Map<string, MutexInterface>()

  /**
   * For a given key, get or create a new lock
   */
  getOrCreateForKey(key: string) {
    let lock = this.#locks.get(key)
    if (!lock) {
      lock = new Mutex()
      this.#locks.set(key, lock)
    }

    return lock
  }

  /**
   * Remove a lock from the map
   */
  delete(key: string) {
    this.#locks.delete(key)
  }
}
