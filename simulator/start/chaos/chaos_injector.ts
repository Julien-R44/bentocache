import { sleep } from '@julr/utils/misc'

/**
 * Some utilities to simulate chaos in tests.
 */
export class ChaosInjector {
  /**
   * Probability of throwing an error
   */
  #throwProbability = 0

  /**
   * Minimum delay in milliseconds
   */
  #minDelay = 0

  /**
   * Maximum delay in milliseconds
   */
  #maxDelay = 0

  /**
   * Randomly throw an error with the given probability
   */
  injectExceptions() {
    if (Math.random() < this.#throwProbability) {
      throw new Error('Chaos: Random error')
    }
  }

  /**
   * Apply a random delay between minDelay and maxDelay
   */
  async injectDelay() {
    const delay = this.#minDelay + Math.random() * (this.#maxDelay - this.#minDelay)
    await sleep(delay)
  }

  /**
   * Apply some chaos : delay and/or throw an error
   */
  async injectChaos() {
    await this.injectDelay()
    this.injectExceptions()
  }

  /**
   * Make the cache always throw an error
   */
  alwaysThrow() {
    this.#throwProbability = 1
    return this
  }

  /**
   * Reset the throw probability to 0
   */
  neverThrow() {
    this.#throwProbability = 0
    return this
  }

  /**
   * Always apply the given delay
   */
  alwaysDelay(minDelay: number, maxDelay: number) {
    this.#minDelay = minDelay
    this.#maxDelay = maxDelay
    return this
  }
}
