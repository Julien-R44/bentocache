import type { CacheStack } from './cache_stack.js'
import { CacheBusMessageType } from '../../types/main.js'
import { CacheWritten } from '../../events/cache/cache_written.js'
import type { CacheItemOptions } from '../cache_item/cache_item_options.js'

export class CacheStackWriter {
  constructor(protected cacheStack: CacheStack) {}

  /**
   * Write a value in the cache stack
   * - Set value in local cache
   * - Set value in remote cache
   * - Publish a message to the bus
   * - Emit a CacheWritten event
   */
  async set(key: string, value: any, options: CacheItemOptions) {
    const item = this.cacheStack.serialize({
      value: value,
      logicalExpiration: options.logicalTtlFromNow(),
      earlyExpiration: options.earlyExpireTtlFromNow(),
    })

    await this.cacheStack.l1?.set(key, item, options)
    await this.cacheStack.l2?.set(key, item, options)
    await this.cacheStack.bus?.publish({ type: CacheBusMessageType.Set, keys: [key] })

    this.cacheStack.emit(new CacheWritten(key, value, this.cacheStack.name))
    return true
  }
}
