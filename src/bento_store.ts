import type {
  CreateBusDriverResult,
  CreateDriverResult,
  L1CacheDriver,
  L2CacheDriver,
  RawCommonOptions,
} from './types/main.js'

/**
 * Create a new store
 */
export function bentostore(options?: RawCommonOptions & { prefix?: string }) {
  return new BentoStore(options)
}

export class BentoStore {
  #baseOptions: RawCommonOptions & { prefix?: string } = {}
  #l1?: CreateDriverResult<L1CacheDriver>
  #l2?: CreateDriverResult<L2CacheDriver>
  #bus?: CreateBusDriverResult

  constructor(baseOptions: RawCommonOptions & { prefix?: string } = {}) {
    this.#baseOptions = baseOptions
  }

  /**
   * Add a L1 layer to your store. This is usually a memory driver
   * for fast access purposes.
   */
  useL1Layer(driver: CreateDriverResult<L1CacheDriver>) {
    this.#l1 = driver
    return this
  }

  /**
   * Add a L2 layer to your store. This is usually something
   * distributed like Redis, DynamoDB, Sql database, etc.
   */
  useL2Layer(driver: CreateDriverResult<L2CacheDriver>) {
    this.#l2 = driver
    return this
  }

  /**
   * Add a bus to your store. It will be used to synchronize L1 layers between
   * different instances of your application.
   */
  useBus(bus: CreateBusDriverResult) {
    this.#bus = bus
    return this
  }

  get entry() {
    return {
      options: this.#baseOptions,
      l1: this.#l1,
      l2: this.#l2,
      bus: this.#bus,
    }
  }
}
