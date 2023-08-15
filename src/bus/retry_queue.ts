/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CacheBusMessage } from '../types/bus.js'

/**
 * The RetryQueue will hold messages that failed to be sent
 * to the bus. We will retry sending them later.
 */
export class RetryQueue {
  #queue = new Map<string, CacheBusMessage>()

  /**
   * Should we enqueue messages
   */
  #enabled = true

  /**
   * Maximum number of messages to keep in the retry queue
   */
  #maxSize: number | null = null

  constructor(enabled = true, maxSize: number | null = null) {
    this.#enabled = enabled
    this.#maxSize = maxSize
  }

  /**
   * Generate a hash for the given message
   */
  #generateMessageHash(message: CacheBusMessage) {
    const orderedKeys = [...message.keys].sort((a, b) => a.localeCompare(b))
    return `${message.type}:${orderedKeys.join(',')}`
  }

  size() {
    return this.#queue.size
  }

  async process(handler: (message: CacheBusMessage) => Promise<boolean>) {
    if (!this.#enabled) return

    for (const message of this.#queue.values()) {
      const result = await handler(message)

      /**
       * As soon as we get a false result, we stop processing the queue
       * and keep the message in the queue.
       */
      if (result === false) {
        break
      }

      this.dequeue()
    }
  }

  /**
   * Add a message to the queue
   *
   * @returns true if the message was added, false if it was already in the queue
   */
  enqueue(message: CacheBusMessage) {
    if (!this.#enabled) return false

    if (this.#maxSize && this.#queue.size >= this.#maxSize) {
      this.dequeue()
    }

    const hash = this.#generateMessageHash(message)
    this.#queue.set(hash, message)

    return true
  }

  /**
   * Dequeue the next message from the queue
   */
  dequeue() {
    if (!this.#enabled) return

    const message = this.#queue.values().next().value
    if (!message) return

    const hash = this.#generateMessageHash(message)
    this.#queue.delete(hash)

    return message
  }
}
