import { pino } from 'pino'
import pinoLoki from 'pino-loki'
import { sleep } from '@julr/utils/misc'

export const BASE_URL = new URL('./tmp/', import.meta.url)
export const REDIS_CREDENTIALS = { host: 'localhost', port: 6379 }

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
    await sleep(ms)
    return value
  }
}

const loadNs = process.hrtime()
const loadMs = new Date().getTime()

function nanoseconds() {
  const diffNs = process.hrtime(loadNs)
  return BigInt(loadMs) * BigInt(1e6) + BigInt(diffNs[0] * 1e9 + diffNs[1])
}

/**
 * Pino logger that could be injected in
 * cache classes for manual and quick testing
 */
export const traceLogger = (pretty = true) => {
  if (pretty) {
    return pino({ level: 'trace', ...(pretty ? { transport: { target: 'pino-pretty' } } : {}) })
  }

  return pino(
    { level: 'trace', timestamp: () => `,"time":${nanoseconds()}` },
    // @ts-expect-error missing types
    pinoLoki({
      batching: false,
      labels: { application: 'bentocache' },
      host: 'http://localhost:3100',
    }),
  )
}
