import pg from 'pg'
import { randomBytes } from 'node:crypto'
import type { Serializable, SubscribeHandler, Transport } from '@boringnode/bus/types/core'

import { decodeMessage, encodeMessage } from './encoder.js'
import { CacheBusMessageType } from '../../../types/bus.js'
import type { CacheBusMessage } from '../../../types/bus.js'
import { quoteChannel, toPostgresChannel } from './channel.js'

export type PostgresTransportOptions = {
  /**
   * Connection string or `pg` client config. Both internal
   * connections are opened from it.
   */
  connection: string | pg.ClientConfig

  /**
   * Maximum time in milliseconds for one publish transaction
   */
  publishTimeout: number

  /**
   * How long in milliseconds the publisher waits after the first message
   * of a batch before sending it, so more messages share the transaction.
   * 0 sends as soon as no transaction is running.
   */
  batchDelay: number

  /**
   * Heartbeat settings in milliseconds, or false to disable the heartbeat
   */
  heartbeat: false | { interval: number; timeout: number }

  /**
   * Called with connection and publish errors
   */
  onError?: (error: Error) => void
}

export type Notification = [channel: string, payload: string]

export type QueuedPublish = {
  notifications: Notification[]

  /**
   * How many of `notifications` were already taken into a transaction
   */
  sent: number

  resolve: () => void
  reject: (error: Error) => void
}

/**
 * Messages published since the last flush that can be sent as one: same
 * channel, type and namespace
 */
type PendingGroup = {
  channel: string
  type: CacheBusMessage['type']
  namespace: string
  keys: Set<string>
}

/**
 * Maximum time to open a connection and run its setup queries
 */
const CONNECT_TIMEOUT = 10_000

/**
 * Keep each transaction short, so it fits in `publishTimeout`. A message
 * larger than this is sent over several transactions.
 */
export const MAX_NOTIFICATIONS_PER_TRANSACTION = 1000
export const MAX_BYTES_PER_TRANSACTION = 1024 * 1024

const MIN_RECONNECT_DELAY = 250
const MAX_RECONNECT_DELAY = 5000

/**
 * How long to wait for the server to close a connection we end before
 * destroying its socket
 */
const DISCARD_GRACE = 1000
const DISCONNECT_GRACE = 2000

/**
 * Without `onError`, each distinct error message is logged to the console
 * at most once in this period
 */
const ERROR_LOG_INTERVAL = 60_000
const MAX_LOGGED_ERRORS = 100

export const HEARTBEAT_DOCS_URL = 'https://bentocache.dev/docs/multi-tier#if-the-heartbeat-fails'

/**
 * Bus transport that uses Postgres LISTEN/NOTIFY.
 *
 * It opens two connections from the same connection settings:
 *
 * - The listener runs `LISTEN` and receives notifications. It is only
 *   replaced when its connection fails or the heartbeat shows that it no
 *   longer receives notifications.
 *
 * - The publisher sends notifications in short transactions, each in one
 *   round trip: `BEGIN`, `SET LOCAL synchronous_commit = off`, one
 *   `pg_notify()` per notification, `COMMIT`. Any error or timeout
 *   replaces only this connection.
 *
 * Every transaction costs Postgres a transaction id, a WAL record, its
 * global notification lock and a wakeup of every listening session, so
 * the publisher sends as few as it can:
 *
 * - Messages published while a transaction runs wait and are sent
 *   together in the next one. With a `batchDelay`, a batch also waits
 *   that long after its first message, unless it already holds
 *   `MAX_NOTIFICATIONS_PER_TRANSACTION` messages. BentoCache waits for
 *   the publish in every write, so the delay adds to write latency.
 * - Messages in a batch with the same channel, type and namespace are
 *   merged into one, with their keys deduplicated. A very large batch is
 *   split over several transactions (see `takeBatch`).
 *
 * Using a transaction makes connection poolers and proxies that split
 * reads from writes send the notifications to the primary.
 *
 * The heartbeat publishes to a channel private to this transport through
 * the publisher and checks that the listener receives it. This tests the
 * whole path, including proxies, instead of a single connection.
 */
export class PostgresTransport implements Transport {
  #options: PostgresTransportOptions
  #id?: string
  #closed = false
  #reconnectCallbacks: Array<() => void> = []

  /**
   * Handlers keyed by Postgres channel name
   */
  #handlers = new Map<string, SubscribeHandler<any>[]>()

  #listener?: pg.Client
  #listenerConnected = false
  #listening = false
  #listenerAttempts = 0
  #listenerTimer?: NodeJS.Timeout

  #publisher?: pg.Client
  #publisherReady = false
  #publisherAttempts = 0
  #publisherTimer?: NodeJS.Timeout

  /**
   * Settles once the first publisher connection succeeds or fails.
   * Publishes made before then wait for it instead of failing.
   */
  #firstPublisherAttempt: Promise<void>
  #endFirstPublisherAttempt!: () => void
  #firstPublisherAttemptDone = false

  #queue: QueuedPublish[] = []
  #flushing = false
  #flushRun?: Promise<void>

  /**
   * Messages not yet merged into `#queue`, keyed by channel, type and
   * namespace, with the callers waiting on them
   */
  #pending = new Map<string, PendingGroup>()
  #pendingWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = []

  /**
   * When the batch being collected got its first message
   */
  #batchOpenedAt = 0

  /**
   * Ends the `batchDelay` wait early
   */
  #wakeFlush?: () => void

  #heartbeatChannel = `bentocache.hb.${randomBytes(12).toString('hex')}`
  #heartbeatTimer?: NodeJS.Timeout
  #heartbeatCheckTimer?: NodeJS.Timeout
  #heartbeatCheckPeriod = 0
  #heartbeatSeq = 0
  #heartbeatReceived = 0
  #lastHeartbeatCheck = 0

  /**
   * When each error message was last logged, for the console fallback
   */
  #loggedErrors = new Map<string, number>()

  #disconnecting?: Promise<void>

  /**
   * Heartbeats that were committed while the listener was listening,
   * keyed by sequence number, with their commit time
   */
  #heartbeatsInFlight = new Map<number, number>()

  constructor(options: PostgresTransportOptions) {
    this.#options = options
    this.#firstPublisherAttempt = new Promise(resolve => {
      this.#endFirstPublisherAttempt = () => {
        this.#firstPublisherAttemptDone = true
        resolve()
      }
    })
    this.#connectListener()
    this.#connectPublisher()

    if (options.heartbeat) {
      this.#heartbeatTimer = setInterval(() => this.#sendHeartbeat(), options.heartbeat.interval)
      this.#heartbeatTimer.unref()

      this.#heartbeatCheckPeriod = heartbeatCheckPeriod(options.heartbeat.timeout)
      this.#lastHeartbeatCheck = performance.now()
      this.#heartbeatCheckTimer = setInterval(
        () => this.#checkHeartbeats(),
        this.#heartbeatCheckPeriod,
      )
      this.#heartbeatCheckTimer.unref()
    }
  }

  setId(id: string): Transport {
    this.#id = id
    return this
  }

  /**
   * The callbacks run every time the publisher becomes usable, including
   * the first time, so the bus can send the messages it queued meanwhile
   */
  onReconnect(callback: () => void): void {
    this.#reconnectCallbacks.push(callback)
  }

  async publish(channel: string, message: Serializable): Promise<void> {
    if (!this.#id) throw new Error('The bus id must be set before publishing')
    if (this.#closed) throw new Error('The Postgres bus is disconnected')

    /**
     * Never reject because of the message content: the bus would keep it at
     * the head of its retry queue forever and block every message behind it.
     *
     * Messages are encoded when the batch is sent, so everything that could
     * make encoding fail is checked here. Encoding one without its keys
     * checks its type and the length of its namespace.
     */
    const cacheMessage = message as CacheBusMessage
    let type = cacheMessage.type
    let keys: unknown = cacheMessage.keys ?? []
    const namespace: unknown = cacheMessage.namespace ?? ''
    if (typeof namespace !== 'string') {
      this.#reportError(new Error('Postgres bus message dropped: its namespace is not a string'))
      return
    }

    /**
     * A key that isn't a string can't be sent. Clearing the namespace
     * invalidates more than needed, but leaves no other instance stale.
     */
    if (!Array.isArray(keys) || !keys.every(key => typeof key === 'string')) {
      this.#reportError(
        new Error(
          'Postgres bus message has keys that are not strings, so its namespace is cleared',
        ),
      )
      type = CacheBusMessageType.Clear
      keys = []
    }

    let encoded
    try {
      encoded = encodeMessage(this.#id, { type, namespace, keys: [] })
    } catch (error) {
      this.#reportError(error)
      return
    }

    if (encoded.tooLarge) {
      this.#reportError(
        new Error(
          'Postgres bus message dropped: its namespace is too long to fit in a notification',
        ),
      )
      return
    }

    /**
     * Right after start, wait for the first connection instead of failing
     * every early write, bounded by `publishTimeout`
     */
    if (!this.#publisherReady && !this.#firstPublisherAttemptDone) {
      await withTimeout(this.#firstPublisherAttempt, this.#options.publishTimeout).catch(() => {})
      if (this.#closed) throw new Error('The Postgres bus is disconnected')
    }

    /**
     * Fail fast while the publisher is down. The bus keeps the message in
     * its retry queue and sends it once the publisher reconnects.
     */
    if (!this.#publisherReady) throw new Error('The Postgres bus publisher is not connected')

    return new Promise<void>((resolve, reject) => {
      this.#openBatch()

      /**
       * The channel and the type can't contain a line feed, so the key is
       * unambiguous
       */
      const pgChannel = toPostgresChannel(channel)
      const groupKey = `${pgChannel}\n${type}\n${namespace}`
      let group = this.#pending.get(groupKey)
      if (!group) {
        group = { channel: pgChannel, type, namespace, keys: new Set() }
        this.#pending.set(groupKey, group)
      }
      for (const key of keys as string[]) group.keys.add(key)

      this.#pendingWaiters.push({ resolve, reject })
      if (this.#pendingWaiters.length >= MAX_NOTIFICATIONS_PER_TRANSACTION) this.#wakeFlush?.()
      void this.#flush()
    })
  }

  async subscribe<T extends Serializable>(
    channel: string,
    handler: SubscribeHandler<T>,
  ): Promise<void> {
    const pgChannel = toPostgresChannel(channel)
    const handlers = this.#handlers.get(pgChannel) ?? []
    handlers.push(handler)
    this.#handlers.set(pgChannel, handlers)

    /**
     * If the listener isn't connected yet, it will LISTEN to every
     * subscribed channel once it is. BentoCache doesn't await this method,
     * so it must not reject: failures go to `onError` and the listener
     * reconnects.
     */
    const listener = this.#listener
    if (!listener || !this.#listenerConnected) return

    try {
      await withTimeout(listener.query(`LISTEN ${quoteChannel(pgChannel)}`), CONNECT_TIMEOUT)
    } catch (error) {
      this.#onListenerLost(listener, error)
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    const pgChannel = toPostgresChannel(channel)
    this.#handlers.delete(pgChannel)

    const listener = this.#listener
    if (!listener || !this.#listenerConnected) return

    try {
      await withTimeout(listener.query(`UNLISTEN ${quoteChannel(pgChannel)}`), CONNECT_TIMEOUT)
    } catch (error) {
      this.#reportError(error)
    }
  }

  /**
   * Every call returns the same promise, so a second call made while the
   * first is still sending pending messages waits for them instead of
   * dropping them. Each namespace of a store shares its bus, so several
   * calls at shutdown are common.
   */
  disconnect(): Promise<void> {
    this.#disconnecting ??= this.#disconnect()
    return this.#disconnecting
  }

  async #disconnect(): Promise<void> {
    this.#closed = true
    clearInterval(this.#heartbeatTimer)
    clearInterval(this.#heartbeatCheckTimer)
    clearTimeout(this.#listenerTimer)
    clearTimeout(this.#publisherTimer)
    this.#endFirstPublisherAttempt()

    await this.#drain()
    this.#rejectQueued(new Error('The Postgres bus is disconnected'))

    const clients = [this.#listener, this.#publisher]
    this.#listener = undefined
    this.#publisher = undefined
    this.#listening = false
    this.#listenerConnected = false
    this.#publisherReady = false

    await Promise.all(clients.map(client => client && closeClient(client, DISCONNECT_GRACE)))
  }

  /**
   * `fallback_application_name` names the session only when the user sets
   * no `application_name` (in the config, the connection string or
   * `PGAPPNAME`), so the bus sessions can be found in `pg_stat_activity`
   */
  #clientConfig(role: 'listener' | 'publisher'): pg.ClientConfig {
    const { connection } = this.#options
    const config = typeof connection === 'string' ? { connectionString: connection } : connection
    return { keepAlive: true, fallback_application_name: `bentocache-bus:${role}`, ...config }
  }

  /**
   * Errors go to `onError`. Without it, they are logged to the console,
   * each distinct message at most once per `ERROR_LOG_INTERVAL`: a broken
   * bus must not fail silently, nor flood the logs while it reconnects.
   */
  #reportError(error: unknown) {
    const normalized = toError(error)
    if (this.#options.onError) {
      try {
        this.#options.onError(normalized)
      } catch {
        // An error in the user's callback must not break the bus
      }
      return
    }

    const now = performance.now()
    const lastLogged = this.#loggedErrors.get(normalized.message)
    if (lastLogged !== undefined && now - lastLogged < ERROR_LOG_INTERVAL) return
    if (this.#loggedErrors.size >= MAX_LOGGED_ERRORS) this.#loggedErrors.clear()
    this.#loggedErrors.set(normalized.message, now)
    console.error('[bentocache] postgres bus error:', normalized)
  }

  #reconnectDelay(attempt: number) {
    const delay = Math.min(MAX_RECONNECT_DELAY, MIN_RECONNECT_DELAY * 2 ** attempt)
    return delay / 2 + Math.random() * (delay / 2)
  }

  /**
   * ---------------------------------------------------------------------
   * Listener
   * ---------------------------------------------------------------------
   */

  #connectListener() {
    if (this.#closed) return

    const client = new pg.Client(this.#clientConfig('listener'))
    this.#listener = client
    this.#listenerConnected = false
    this.#listening = false

    client.on('error', error => this.#onListenerLost(client, error))
    client.on('end', () =>
      this.#onListenerLost(client, new Error('Postgres bus listener connection ended')),
    )
    client.on('notification', msg => this.#onNotification(msg.channel, msg.payload))

    const setup = async () => {
      await client.connect()
      if (client !== this.#listener) return

      /**
       * From here on, `subscribe()` sends its own LISTEN on this client,
       * so the snapshot below can't miss a channel.
       */
      await disableIdleSessionTimeout(client)
      if (client !== this.#listener) return

      this.#listenerConnected = true
      const channels = [this.#heartbeatChannel, ...this.#handlers.keys()]
      for (const channel of channels) await client.query(`LISTEN ${quoteChannel(channel)}`)
    }

    withTimeout(setup(), CONNECT_TIMEOUT)
      .then(() => {
        if (client !== this.#listener) return
        this.#listening = true
        this.#listenerAttempts = 0
        this.#heartbeatsInFlight.clear()
      })
      .catch(error => this.#onListenerLost(client, error))
  }

  #onListenerLost(client: pg.Client | undefined, error: unknown) {
    if (!client || client !== this.#listener) return

    this.#listener = undefined
    this.#listenerConnected = false
    this.#listening = false
    this.#heartbeatsInFlight.clear()
    discard(client)

    if (this.#closed) return
    this.#reportError(error)

    const delay = this.#reconnectDelay(this.#listenerAttempts++)
    this.#listenerTimer = setTimeout(() => this.#connectListener(), delay)
  }

  #onNotification(channel: string, payload: string | undefined) {
    if (channel === this.#heartbeatChannel) {
      const seq = Number(payload)
      if (!Number.isInteger(seq)) return
      this.#heartbeatReceived = Math.max(this.#heartbeatReceived, seq)
      for (const pending of this.#heartbeatsInFlight.keys()) {
        if (pending <= seq) this.#heartbeatsInFlight.delete(pending)
      }
      return
    }

    const handlers = this.#handlers.get(channel)
    if (!handlers || payload === undefined) return

    const message = decodeMessage(payload)
    if (!message || message.busId === this.#id) return

    for (const handler of handlers) {
      try {
        const result = handler(message.payload)
        if (result instanceof Promise) result.catch(error => this.#reportError(error))
      } catch (error) {
        this.#reportError(error)
      }
    }
  }

  /**
   * ---------------------------------------------------------------------
   * Publisher
   * ---------------------------------------------------------------------
   */

  #connectPublisher() {
    if (this.#closed) return

    const client = new pg.Client(this.#clientConfig('publisher'))
    this.#publisher = client
    this.#publisherReady = false

    client.on('error', error => this.#onPublisherLost(client, error))
    client.on('end', () =>
      this.#onPublisherLost(client, new Error('Postgres bus publisher connection ended')),
    )

    /**
     * The publisher is usable once it has committed a notification. A
     * connection alone isn't enough: through a proxy, it can succeed while
     * no primary is available.
     */
    const listenerAtSend = this.#listening ? this.#listener : undefined
    const seq = ++this.#heartbeatSeq

    /**
     * Unlike the listener, the publisher keeps `idle_session_timeout`: the
     * heartbeat keeps it busy, and a closed publisher is simply replaced.
     */
    withTimeout(client.connect(), CONNECT_TIMEOUT)
      .then(() =>
        withTimeout(
          sendNotifications(client, [[this.#heartbeatChannel, String(seq)]]),
          this.#options.publishTimeout,
        ),
      )
      .then(() => {
        if (client !== this.#publisher) return
        this.#recordHeartbeat(seq, listenerAtSend)
        this.#publisherReady = true
        this.#publisherAttempts = 0
        this.#endFirstPublisherAttempt()
        for (const callback of this.#reconnectCallbacks) callback()
        void this.#flush()
      })
      .catch(error => this.#onPublisherLost(client, error))
  }

  #onPublisherLost(client: pg.Client, error: unknown) {
    if (client !== this.#publisher) return

    this.#publisher = undefined
    this.#publisherReady = false
    discard(client)
    this.#endFirstPublisherAttempt()

    const reason = toError(error)
    this.#rejectQueued(reason)

    if (this.#closed) return
    this.#reportError(reason)

    const delay = this.#reconnectDelay(this.#publisherAttempts++)
    this.#publisherTimer = setTimeout(() => this.#connectPublisher(), delay)
  }

  #enqueue(notifications: Notification[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#openBatch()
      this.#queue.push({ notifications, sent: 0, resolve, reject })
      void this.#flush()
    })
  }

  /**
   * Start the `batchDelay` wait when a message arrives with nothing else
   * waiting to be sent
   */
  #openBatch() {
    if (this.#queue.length === 0 && this.#pending.size === 0) {
      this.#batchOpenedAt = performance.now()
    }
  }

  #rejectQueued(error: Error) {
    for (const item of this.#queue.splice(0)) item.reject(error)
    for (const waiter of this.#pendingWaiters.splice(0)) waiter.reject(error)
    this.#pending.clear()
    this.#wakeFlush?.()
  }

  /**
   * Encode the pending messages, one per channel, type and namespace, and
   * queue them as one item that settles every caller at once.
   *
   * Messages of different types or namespaces can end up in another order
   * than they were published. Every message only deletes or expires
   * entries on the receiving side, so the result is the same in any order.
   */
  #mergePending() {
    if (this.#pending.size === 0) return

    const groups = [...this.#pending.values()]
    const waiters = this.#pendingWaiters
    this.#pending = new Map()
    this.#pendingWaiters = []

    /**
     * `publish()` already checked everything encoding depends on. Should a
     * group still fail, it is reported and skipped, and its callers settle
     * with the rest of the batch instead of waiting forever.
     */
    const notifications: Notification[] = []
    for (const group of groups) {
      try {
        const { payloads, replacedByClear } = encodeMessage(this.#id!, {
          type: group.type,
          namespace: group.namespace,
          keys: [...group.keys],
        })
        if (replacedByClear) {
          this.#reportError(
            new Error(
              `Postgres bus message has a key too long for a notification, so namespace ` +
                `"${group.namespace}" is cleared on other instances`,
            ),
          )
        }
        for (const payload of payloads) notifications.push([group.channel, payload])
      } catch (error) {
        this.#reportError(error)
      }
    }

    this.#queue.push({
      notifications,
      sent: 0,
      resolve: () => {
        for (const waiter of waiters) waiter.resolve()
      },
      reject: error => {
        for (const waiter of waiters) waiter.reject(error)
      },
    })
  }

  /**
   * Wait until `batchDelay` has passed since the batch opened, unless the
   * batch is already full. Returns early when woken by `#wakeFlush`.
   */
  async #waitForBatch() {
    const { batchDelay } = this.#options
    if (batchDelay === 0) return

    /**
     * `performance.now()` never goes back, unlike the wall clock. The cap
     * is a second guard against a wait longer than `batchDelay`.
     */
    const wait = Math.min(this.#batchOpenedAt + batchDelay - performance.now(), batchDelay)
    if (wait <= 0 || this.#closed) return
    if (this.#pendingWaiters.length >= MAX_NOTIFICATIONS_PER_TRANSACTION) return

    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, wait)
      this.#wakeFlush = () => {
        clearTimeout(timer)
        resolve()
      }
    })
    this.#wakeFlush = undefined
  }

  /**
   * Send what is queued, unless a flush is already running. Returns the
   * running flush, so `disconnect()` can wait for it.
   */
  #flush(): Promise<void> {
    if (this.#flushing) return this.#flushRun ?? Promise.resolve()
    this.#flushing = true
    this.#flushRun = this.#runFlush()
    return this.#flushRun
  }

  /**
   * Send what is still queued before closing, within one `publishTimeout`.
   * New publishes are already refused, and the batch delay is skipped.
   */
  async #drain() {
    const deadline = performance.now() + this.#options.publishTimeout
    this.#wakeFlush?.()

    while (this.#queue.length > 0 || this.#pending.size > 0) {
      const remaining = deadline - performance.now()
      if (remaining <= 0 || !this.#publisherReady) return
      await withTimeout(this.#flush(), remaining).catch(() => {})
    }
  }

  async #runFlush() {
    try {
      while (this.#publisherReady && this.#publisher) {
        if (this.#queue.length === 0 && this.#pending.size === 0) break

        await this.#waitForBatch()
        const client = this.#publisher
        if (!this.#publisherReady || !client) break

        this.#mergePending()
        const { notifications, completed } = takeBatch(this.#queue)
        if (notifications.length === 0) {
          for (const item of completed) item.resolve()
          continue
        }

        try {
          await withTimeout(sendNotifications(client, notifications), this.#options.publishTimeout)
          for (const item of completed) item.resolve()
        } catch (error) {
          /**
           * A message whose first parts were already committed is rejected
           * too, by `#onPublisherLost` below, and the bus sends it again
           * whole. Receiving some keys twice is harmless.
           */
          const reason = toError(error)
          for (const item of completed) item.reject(reason)

          /**
           * The connection may be stuck in the middle of a transaction.
           * Replace it rather than trying to roll back.
           */
          this.#onPublisherLost(client, reason)
        }
      }
    } catch (error) {
      /**
       * Nothing above should throw. Should it, the publisher is replaced
       * so that queued callers are rejected, and the bus retries them.
       */
      if (this.#publisher) this.#onPublisherLost(this.#publisher, error)
      else this.#reportError(error)
    } finally {
      this.#flushing = false
    }
  }

  /**
   * ---------------------------------------------------------------------
   * Heartbeat
   * ---------------------------------------------------------------------
   */

  /**
   * Fail the listener once a committed heartbeat is older than `timeout`.
   * This runs more often than heartbeats are sent, so a silent failure is
   * detected at most `interval + timeout + timeout / 3` after it happens.
   */
  #checkHeartbeats() {
    const heartbeat = this.#options.heartbeat
    if (!heartbeat || this.#closed) return

    const now = performance.now()
    discountStall(
      this.#heartbeatsInFlight,
      now - this.#lastHeartbeatCheck - this.#heartbeatCheckPeriod,
    )
    this.#lastHeartbeatCheck = now

    if (!this.#listening) return
    for (const committedAt of this.#heartbeatsInFlight.values()) {
      if (now - committedAt > heartbeat.timeout) {
        this.#onListenerLost(
          this.#listener,
          new Error(
            `Postgres bus listener did not receive a heartbeat within ${heartbeat.timeout}ms, ` +
              `so it is replaced. For the usual causes, see ${HEARTBEAT_DOCS_URL}`,
          ),
        )
        return
      }
    }
  }

  #sendHeartbeat() {
    /**
     * A failed heartbeat replaces the publisher like any failed publish.
     * It never replaces the listener: only a heartbeat that was committed
     * and not received shows that the listener is broken.
     */
    if (!this.#options.heartbeat || this.#closed || !this.#publisherReady) return

    const seq = ++this.#heartbeatSeq
    const listenerAtSend = this.#listening ? this.#listener : undefined
    this.#enqueue([[this.#heartbeatChannel, String(seq)]])
      .then(() => this.#recordHeartbeat(seq, listenerAtSend))
      .catch(() => {})
  }

  #recordHeartbeat(seq: number, listenerAtSend: pg.Client | undefined) {
    if (!this.#options.heartbeat || !listenerAtSend) return
    if (listenerAtSend !== this.#listener || !this.#listening) return

    /**
     * The notification can arrive before the COMMIT result is processed
     */
    if (seq <= this.#heartbeatReceived) return

    this.#heartbeatsInFlight.set(seq, performance.now())
  }
}

/**
 * Send notifications in one transaction and one round trip.
 * `synchronous_commit = off` keeps the commit from waiting for the WAL
 * flush, which shortens the time Postgres holds its global notification
 * lock.
 *
 * Several statements can only go in one query without parameters, so
 * channels and payloads are escaped as literals. Both are ASCII (see
 * `toPostgresChannel` and `encodeMessage`). If a statement fails,
 * Postgres skips the rest, COMMIT included, and the caller replaces the
 * connection.
 */
async function sendNotifications(client: pg.Client, notifications: Notification[]) {
  const values = notifications
    .map(
      ([channel, payload]) => `(${client.escapeLiteral(channel)},${client.escapeLiteral(payload)})`,
    )
    .join(',')

  await client.query(
    'BEGIN;SET LOCAL synchronous_commit = off;' +
      `SELECT pg_notify(c, p) FROM (VALUES ${values}) AS t(c, p);COMMIT`,
  )
}

/**
 * Take the notifications for the next transaction from the head of the
 * queue: up to `maxNotifications` and `maxBytes`, but always at least
 * one. Several small messages share a transaction, and a large message
 * is split over several.
 *
 * Returns the messages whose last notification is in this batch. They
 * are removed from the queue. A message that is only partly in the batch
 * stays at the head of the queue for the next one.
 */
export function takeBatch(
  queue: QueuedPublish[],
  maxNotifications = MAX_NOTIFICATIONS_PER_TRANSACTION,
  maxBytes = MAX_BYTES_PER_TRANSACTION,
): { notifications: Notification[]; completed: QueuedPublish[] } {
  const notifications: Notification[] = []
  const completed: QueuedPublish[] = []
  let bytes = 0

  while (queue.length > 0) {
    const item = queue[0]

    while (item.sent < item.notifications.length) {
      const notification = item.notifications[item.sent]
      const size = notification[0].length + notification[1].length
      const full = notifications.length >= maxNotifications || bytes + size > maxBytes
      if (notifications.length > 0 && full) return { notifications, completed }

      notifications.push(notification)
      bytes += size
      item.sent++
    }

    completed.push(queue.shift()!)
  }

  return { notifications, completed }
}

/**
 * Don't count time the process was frozen (a long garbage collection, a
 * blocking call, a paused debugger) against heartbeats in flight. After a
 * stall, Node runs due timers before it reads sockets, so a heartbeat can
 * be waiting unread on a healthy listener when the check runs.
 *
 * `stall` is how late the heartbeat check timer fired. Moving the commit
 * times forward by it measures each heartbeat's age in time the process
 * was running.
 */
/**
 * How often heartbeats in flight are checked: often enough that a missing
 * one is detected soon after `timeout`, without a timer running far more
 * often than needed
 */
export function heartbeatCheckPeriod(timeout: number) {
  return Math.max(1, Math.round(timeout / 3))
}

export function discountStall(inFlight: Map<number, number>, stall: number) {
  if (stall <= 0) return
  for (const [seq, committedAt] of inFlight) inFlight.set(seq, committedAt + stall)
}

/**
 * Postgres 14+ closes sessions that stay idle longer than
 * `idle_session_timeout`, and receiving notifications doesn't count as
 * activity. The listener never runs a query once it listens, so a
 * database or role with that setting would close it over and over.
 *
 * - The timeout is turned off even when the server has none yet. A timeout
 *   enabled later by a config reload reaches this session on its next
 *   query, such as a LISTEN for a new channel, and a session-level `SET`
 *   overrides reloaded values.
 * - `current_setting(..., true)` returns NULL on versions without the
 *   setting, and nothing is changed there.
 * - A plain `SET` is used because poolers in transaction mode, such as
 *   PgDog, track it for this client only and reset it before handing the
 *   server connection to another client. A `SELECT set_config(...)` is
 *   not tracked and would stay on a server connection other clients use.
 */
async function disableIdleSessionTimeout(client: pg.Client) {
  const result = await client.query(
    "SELECT current_setting('idle_session_timeout', true) AS timeout",
  )
  const timeout: unknown = result.rows[0]?.timeout
  if (timeout === null || timeout === undefined) return
  await client.query('SET idle_session_timeout = 0')
}

/**
 * Close a client we no longer use, without waiting for it
 */
function discard(client: pg.Client) {
  client.removeAllListeners()
  client.on('error', () => {})
  void closeClient(client, DISCARD_GRACE)
}

/**
 * End a client, then destroy its socket if the server hasn't closed the
 * connection within `grace`. On an idle client, `end()` waits for the
 * server to close its side, which a stalled server or proxy never does,
 * and the open socket would keep the process alive. Never rejects.
 */
async function closeClient(client: pg.Client, grace: number) {
  try {
    await withTimeout(client.end(), grace)
  } catch {
    try {
      client.connection.stream.destroy()
    } catch {
      // Nothing more can be done
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Postgres bus operation timed out after ${ms}ms`)),
      ms,
    )
    timer.unref()
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Normalize anything thrown into an Error with a useful message. A refused
 * connection to a host with several addresses (e.g. `localhost`) fails
 * with an `AggregateError` whose own message is empty.
 */
function toError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(String(error))
  if (error.message) return error

  const details =
    error instanceof AggregateError
      ? error.errors
          .map(inner => (inner instanceof Error ? inner.message : String(inner)))
          .filter(Boolean)
          .join('; ')
      : ''
  const code = (error as NodeJS.ErrnoException).code
  return new Error(`Postgres bus connection error: ${details || code || error.name}`, {
    cause: error,
  })
}
