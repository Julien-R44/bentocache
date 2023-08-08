import type { CacheBusMessage } from '../types/bus.js'

/**
 * The RetryQueue will hold messages that failed to be sent
 * to the bus. We will retry sending them later.
 *
 * We use a hash set for a fast lookup before inserting a
 * message into the queue to avoid duplicates.
 */
export class RetryQueue {
  #queuedItems: CacheBusMessage[] = []
  #messageHashSet = new Set<string>()

  /**
   * Generate a hash for the given message
   */
  #generateMessageHash(message: CacheBusMessage) {
    const orderedKeys = [...message.keys].sort((a, b) => a.localeCompare(b))
    return `${message.type}:${orderedKeys.join(',')}`
  }

  size() {
    return this.#queuedItems.length
  }

  /**
   * Add a message to the queue
   *
   * @returns true if the message was added, false if it was already in the queue
   */
  enqueue(message: CacheBusMessage) {
    const hash = this.#generateMessageHash(message)

    if (this.#messageHashSet.has(hash)) {
      return false
    }

    this.#messageHashSet.add(hash)
    this.#queuedItems.push(message)

    return true
  }

  /**
   * Dequeue the next message from the queue
   */
  dequeue() {
    const message = this.#queuedItems.shift()
    if (!message) {
      return
    }

    const hash = this.#generateMessageHash(message)
    this.#messageHashSet.delete(hash)

    return message
  }
}
