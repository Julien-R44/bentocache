import Keyv from "keyv"
import QuickLRU from "quick-lru"
import { CacheDriverContract, MemoryConfig } from "../types/main.js"
import { KeyvDriver } from "./keyv_driver.js"

export class Memory extends KeyvDriver implements CacheDriverContract {
  constructor(config: MemoryConfig) {
    super()
    this.createStore(config)
  }

  protected createStore(_config: MemoryConfig) {
    this.store = new QuickLRU({ maxSize: 1000 }) as any
    this.keyv = new Keyv({ store: this.store })
  }
}
