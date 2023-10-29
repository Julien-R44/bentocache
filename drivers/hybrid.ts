import type { memoryDriver } from './memory.js'
import type { CreateDriverResult, CreateBusDriverResult } from '../src/types/main.js'

/**
 * Create a new Hybrid driver
 */
export function hybridDriver(options: {
  local: ReturnType<typeof memoryDriver>
  remote: CreateDriverResult
  bus?: CreateBusDriverResult
}): CreateDriverResult {
  return {
    l1: options.local.l1,
    l2: options.remote.l1,
    bus: options.bus,
  }
}
