import { setTimeout } from 'node:timers/promises'

export class ChaosUtils {
  static maybeThrow(probability: number) {
    if (Math.random() < probability) {
      throw new Error('Chaos: Random error')
    }
  }

  static async maybeDelay(minDelay: number, maxDelay: number) {
    const delay = minDelay + Math.random() * (maxDelay - minDelay)
    await setTimeout(delay)
  }

  static async maybeApplyChaos(throwProbability: number, minDelay: number, maxDelay: number) {
    await this.maybeDelay(minDelay, maxDelay)
    this.maybeThrow(throwProbability)
  }
}
