import Keyv from "keyv"
import {KeyvFile} from "keyv-file"
import { CacheDriverContract, FileConfig } from "../types/main.js"
import { KeyvDriver } from "./keyv_driver.js"

export class File extends KeyvDriver implements CacheDriverContract {
  constructor(config: FileConfig) {
    super()
    this.createStore(config)
  }

  protected createStore(config: FileConfig) {
    this.store = new KeyvFile(config)
    this.keyv = new Keyv({ store: this.store, ttl: config.ttl })
  }
}
