import { pino } from 'pino'
import { setTimeout } from 'node:timers/promises'

export const BASE_URL = new URL('./tmp/', import.meta.url)

export const REDIS_CREDENTIALS = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT),
}

/**
 * Returns a factory that will throw an error when invoked
 */
export function throwingFactory(errorMsg = 'error') {
  return () => {
    throw new Error(errorMsg)
  }
}

/**
 * Returns a factory that will take some time to return the given value
 */
export function slowFactory(ms: number, value: any) {
  return async () => {
    await setTimeout(ms)
    return value
  }
}

/**
 * Pino logger that could be injected in
 * cache classes for manual and quick testing
 */
import pinoLoki from 'pino-loki'

const loadNs = process.hrtime()
const loadMs = new Date().getTime()

function nanoseconds() {
  let diffNs = process.hrtime(loadNs)
  return BigInt(loadMs) * BigInt(1e6) + BigInt(diffNs[0] * 1e9 + diffNs[1])
}

export const traceLogger = (pretty = true) => {
  if (pretty) {
    return pino({ level: 'trace', ...(pretty ? { transport: { target: 'pino-pretty' } } : {}) })
  }

  return pino(
    { level: 'trace', timestamp: () => `,"time":${nanoseconds()}` },
    // @ts-expect-error
    pinoLoki({
      batching: false,
      labels: { application: 'bentocache' },
      host: 'http://localhost:3100',
    })
  )
}
