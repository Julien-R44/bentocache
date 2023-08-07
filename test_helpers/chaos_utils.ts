import { setTimeout } from 'node:timers/promises'

/**
 * Some utilities to simulate chaos in tests.
 */
export class ChaosUtils {
  /**
   * Randomly throw an error with the given probability
   */
  static maybeThrow(probability: number) {
    if (Math.random() < probability) {
      throw new Error('Chaos: Random error')
    }
  }

  /**
   * Apply a random delay between minDelay and maxDelay
   */
  static async maybeDelay(minDelay: number, maxDelay: number) {
    const delay = minDelay + Math.random() * (maxDelay - minDelay)
    await setTimeout(delay)
  }

  /**
   * Apply some chaos : delay and/or throw an error
   */
  static async maybeApplyChaos(throwProbability: number, minDelay: number, maxDelay: number) {
    await this.maybeDelay(minDelay, maxDelay)
    this.maybeThrow(throwProbability)
  }
}
