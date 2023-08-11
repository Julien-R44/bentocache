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
  return { local: options.local.local, remote: options.remote.local, bus: options.bus }
}
