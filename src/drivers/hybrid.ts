import type { CreateDriverResult, CreateBusDriverResult } from '../types/main.js'
import type { memoryDriver } from './memory.js'

export function hybridDriver(options: {
  local: ReturnType<typeof memoryDriver>
  remote: CreateDriverResult
  bus: CreateBusDriverResult
}) {
  return {
    local: options.local.local,
    remote: options.remote.local,
    bus: options.bus,
  }
}
