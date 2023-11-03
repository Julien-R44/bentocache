import { Memory } from '../src/drivers/memory.js'
import type { CreateDriverResult } from '../src/types/main.js'
import type { MemoryConfig } from '../src/types/options/drivers_options.js'

/**
 * Create a new memory driver
 */
export function memoryDriver(options: MemoryConfig): CreateDriverResult<Memory> {
  return {
    options,
    factory: (config: MemoryConfig) => new Memory(config),
  }
}
