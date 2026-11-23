import { resolveTtl } from '../helpers.js'
import { PostgresTransport } from '../bus/transports/postgres/postgres_transport.js'
import type {
  BusOptions,
  CreateBusDriverResult,
  Duration,
  PostgresBusConfig,
} from '../types/main.js'

const DEFAULT_PUBLISH_TIMEOUT = 2000
const DEFAULT_BATCH_DELAY = 0
const DEFAULT_HEARTBEAT_INTERVAL = 30_000
const DEFAULT_HEARTBEAT_TIMEOUT = 15_000

/**
 * Node turns timer delays outside 1 to 2^31 - 1 milliseconds (about 24.8
 * days) into 1 millisecond, so durations outside that range are rejected
 */
const MIN_DURATION = 1
const MAX_DURATION = 2 ** 31 - 1

function toMilliseconds(
  name: string,
  value: Duration | undefined,
  defaultValue: number,
  min = MIN_DURATION,
) {
  const error = new TypeError(
    `postgresBusDriver: "${name}" must be a duration between ${min}ms and ${MAX_DURATION}ms (about 24 days)`,
  )

  let ms: number | undefined
  try {
    ms = resolveTtl(value ?? undefined, defaultValue)
  } catch {
    throw error
  }

  if (typeof ms !== 'number' || !(ms >= min && ms <= MAX_DURATION)) throw error
  return ms
}

/**
 * Create a bus driver that uses Postgres LISTEN/NOTIFY to send messages
 * between your different processes.
 *
 * It opens two connections from the connection you pass: one that
 * listens and one that publishes. It doesn't create any table.
 */
export function postgresBusDriver(options: PostgresBusConfig & BusOptions): CreateBusDriverResult {
  if (!options?.connection) {
    throw new TypeError('postgresBusDriver: "connection" is required')
  }

  const publishTimeout = toMilliseconds(
    'publishTimeout',
    options.publishTimeout,
    DEFAULT_PUBLISH_TIMEOUT,
  )

  /**
   * 0, the default, sends each batch as soon as no transaction is running
   */
  const batchDelay = toMilliseconds('batchDelay', options.batchDelay, DEFAULT_BATCH_DELAY, 0)

  let heartbeat: false | { interval: number; timeout: number } = false
  if (options.heartbeat !== false) {
    const interval = toMilliseconds(
      'heartbeat.interval',
      options.heartbeat?.interval,
      DEFAULT_HEARTBEAT_INTERVAL,
    )
    const timeout = toMilliseconds(
      'heartbeat.timeout',
      options.heartbeat?.timeout,
      DEFAULT_HEARTBEAT_TIMEOUT,
    )
    heartbeat = { interval, timeout }
  }

  return {
    options,
    factory: () =>
      new PostgresTransport({
        connection: options.connection,
        publishTimeout,
        batchDelay,
        heartbeat,
        onError: options.onError,
      }),
  }
}
