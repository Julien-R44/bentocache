import type { Factory } from '../../types/helpers.js'
import { TwoTierHandler } from './two_tier_handler.js'
import type { CacheStack } from '../stack/cache_stack.js'
import { SingleTierHandler } from './single_tier_handler.js'
import type { CacheStackWriter } from '../stack/cache_stack_writer.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

export class GetSetHandler {
  #singleTierHandler: SingleTierHandler
  #twoTierHandler: TwoTierHandler

  constructor(
    private stack: CacheStack,
    private stackWriter: CacheStackWriter,
  ) {
    this.#singleTierHandler = new SingleTierHandler(this.stack, this.stackWriter)
    this.#twoTierHandler = new TwoTierHandler(this.stack, this.stackWriter)
  }

  /**
   * In the case where we have an L1 and an L2, the flow is quite different
   * from the one where we only have an L2.
   *
   * Therefore we come here to determine which handler to use
   * depending on the configuration of the stack.
   */
  async handle(key: string, factory: Factory, options: CacheEntryOptions) {
    if (this.stack.l2 && !this.stack.l1) {
      return await this.#singleTierHandler.handle(key, factory, options)
    }

    return await this.#twoTierHandler.handle(key, factory, options)
  }
}
