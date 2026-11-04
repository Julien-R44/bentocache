import pg from 'pg'
import net from 'node:net'
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { sleep } from '@julr/utils/misc'

import { BentoCache, bentostore } from '../../index.js'
import { memoryDriver } from '../../src/drivers/memory.js'
import { POSTGRES_CREDENTIALS } from '../helpers/index.js'
import { CacheBusMessageType } from '../../src/types/bus.js'
import type { CacheBusMessage } from '../../src/types/bus.js'
import type { PostgresBusConfig } from '../../src/types/main.js'
import { postgresBusDriver } from '../../src/drivers/postgres.js'
import type {
  Notification,
  QueuedPublish,
} from '../../src/bus/transports/postgres/postgres_transport.js'
import {
  HEARTBEAT_DOCS_URL,
  MAX_BYTES_PER_TRANSACTION,
  MAX_NOTIFICATIONS_PER_TRANSACTION,
  discountStall,
  heartbeatCheckPeriod,
  takeBatch,
} from '../../src/bus/transports/postgres/postgres_transport.js'

const PG_HOST = process.env.POSTGRES_HOST || 'localhost'
const PG_PORT = Number(process.env.POSTGRES_PORT) || 5432
const PG_CONNECTION = { ...POSTGRES_CREDENTIALS, host: PG_HOST, port: PG_PORT }

/**
 * Poll until `fn` returns true
 */
async function until(
  fn: () => boolean | Promise<boolean>,
  timeout = 10_000,
  message = 'condition',
) {
  const start = Date.now()
  while (!(await fn())) {
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${message}`)
    await sleep(25)
  }
}

async function adminQuery(sql: string, params: unknown[] = []) {
  const client = new pg.Client(PG_CONNECTION)
  await client.connect()
  try {
    return await client.query(sql, params)
  } finally {
    await client.end()
  }
}

async function backendCount(applicationName: string) {
  const result = await adminQuery(
    'SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1',
    [applicationName],
  )
  return result.rows[0].count as number
}

type TestBus = ReturnType<typeof createBus>

/**
 * Create a transport with its own application name, so the test can find
 * and kill its connections
 */
function createBus(id: string, options: Partial<PostgresBusConfig> = {}, connection = {}) {
  const applicationName = `bentocache-test-${randomUUID().slice(0, 8)}`
  const errors: Error[] = []
  const received: Array<{ channel: string; message: CacheBusMessage }> = []
  let reconnects = 0

  const transport = postgresBusDriver({
    connection: { ...PG_CONNECTION, application_name: applicationName, ...connection },
    onError: error => errors.push(error),
    ...options,
  })
    .factory(null)
    .setId(id)

  transport.onReconnect(() => reconnects++)

  return {
    id,
    transport,
    errors,
    received,
    applicationName,
    get reconnects() {
      return reconnects
    },
    subscribe(channel: string) {
      return transport.subscribe<CacheBusMessage>(channel, message => {
        received.push({ channel, message })
      })
    },
  }
}

async function closeAll(...buses: TestBus[]) {
  await Promise.all(buses.map(bus => bus.transport.disconnect()))
}

function message(keys: string[], type = CacheBusMessageType.Set): CacheBusMessage {
  return { type, namespace: 'users', keys }
}

/**
 * Publish from `from` until `to` receives it: proves that the publisher
 * of one and the listener of the other are both up
 */
async function waitForPath(from: TestBus, to: TestBus, channel: string, timeout = 15_000) {
  const key = `probe:${randomUUID()}`
  await until(
    async () => {
      await from.transport.publish(channel, message([key])).catch(() => {})
      await sleep(50)
      return to.received.some(r => r.message.keys.includes(key))
    },
    timeout,
    `a message from ${from.id} to reach ${to.id}`,
  )
}

/**
 * TCP proxy in front of Postgres that can silently stop forwarding on the
 * connections it already has, like a dead proxy or a half-open socket
 */
async function createFreezableProxy() {
  const active: Array<{ client: net.Socket; server: net.Socket }> = []
  const sockets: net.Socket[] = []
  const server = net.createServer(client => {
    const upstream = net.connect(PG_PORT, PG_HOST)
    client.pipe(upstream)
    upstream.pipe(client)
    client.on('error', () => upstream.destroy())
    upstream.on('error', () => client.destroy())
    active.push({ client, server: upstream })
    sockets.push(client, upstream)
  })

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as net.AddressInfo).port

  return {
    port,
    freezeExisting() {
      for (const pair of active.splice(0)) {
        pair.client.unpipe(pair.server)
        pair.server.unpipe(pair.client)
        pair.client.pause()
        pair.server.pause()
      }
    },
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise(resolve => server.close(resolve))
    },
  }
}

/**
 * Record every `pg.Client` that connects while the test runs
 */
function captureClients(cleanup: (handler: () => void) => void) {
  const clients: pg.Client[] = []
  const connect = pg.Client.prototype.connect
  pg.Client.prototype.connect = function (this: pg.Client, ...args: any[]) {
    clients.push(this)
    return (connect as any).apply(this, args)
  } as any
  cleanup(() => {
    pg.Client.prototype.connect = connect
  })
  return clients
}

test.group('Postgres bus', group => {
  group.each.timeout(30_000)

  test('delivers messages between instances and ignores its own', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus1.subscribe('channel')
    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')

    bus1.received.length = 0
    bus2.received.length = 0
    await bus1.transport.publish('channel', message(['user:1', 'café:日本']))
    await until(() => bus2.received.length === 1)
    await sleep(100)

    assert.deepEqual(bus2.received, [
      { channel: 'channel', message: message(['user:1', 'café:日本']) },
    ])
    assert.deepEqual(bus1.received, [])
    assert.deepEqual(bus1.errors, [])
    assert.deepEqual(bus2.errors, [])
  })

  test('opens exactly two connections and closes them on disconnect', async ({ assert }) => {
    const bus = createBus('bus-1')
    await bus.subscribe('channel')
    await until(() => bus.reconnects > 0)

    assert.equal(await backendCount(bus.applicationName), 2)

    await bus.transport.disconnect()
    await until(async () => (await backendCount(bus.applicationName)) === 0)
    await assert.rejects(
      () => bus.transport.publish('channel', message(['a'])),
      'The Postgres bus is disconnected',
    )
  })

  test('creates no table or other database object', async ({ assert, cleanup }) => {
    const objectCount = async () => {
      const result = await adminQuery(
        `SELECT count(*)::int AS count FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`,
      )
      return result.rows[0].count as number
    }

    const before = await objectCount()
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')

    assert.equal(await objectCount(), before)
  })

  test('holds publishes made before the first connection, then calls onReconnect', async ({
    assert,
    cleanup,
  }) => {
    const bus2 = createBus('bus-2')
    cleanup(() => bus2.transport.disconnect())
    await bus2.subscribe('channel')
    await until(() => bus2.reconnects === 1)

    /**
     * bus-1 was just created, so its publisher isn't connected yet
     */
    const bus1 = createBus('bus-1')
    cleanup(() => bus1.transport.disconnect())
    await bus1.transport.publish('channel', message(['early']))
    assert.equal(bus1.reconnects, 1)

    await until(() => bus2.received.some(r => r.message.keys.includes('early')))
    assert.deepEqual(bus1.errors, [])
  })

  test('rejects publishes once the first connection has failed', async ({ assert, cleanup }) => {
    const bus = createBus('bus-1', {}, { host: '127.0.0.1', port: 1 })
    cleanup(() => bus.transport.disconnect())

    await assert.rejects(
      () => bus.transport.publish('channel', message(['a'])),
      'The Postgres bus publisher is not connected',
    )
    assert.isAbove(bus.errors.length, 0)

    /**
     * Later publishes fail right away
     */
    const startedAt = Date.now()
    await assert.rejects(
      () => bus.transport.publish('channel', message(['b'])),
      'The Postgres bus publisher is not connected',
    )
    assert.isBelow(Date.now() - startedAt, 1000)
  })

  test('works with channel names longer than 63 bytes', async ({ assert, cleanup }) => {
    const channel = `bentocache.notifications:${'a-very-long-store-name-'.repeat(4)}`
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe(channel)
    await waitForPath(bus1, bus2, channel)

    assert.isTrue(bus2.received.every(r => r.channel === channel))
    assert.deepEqual(bus2.errors, [])
  })

  test('delivers keys, namespaces and channel names in any language', async ({
    assert,
    cleanup,
  }) => {
    const channel = 'bentocache.notifications:магазин'
    const keys = [
      'zh:用户资料',
      'ar:مستخدم',
      'hi:उपयोगकर्ता',
      'emoji:👨‍👩‍👧‍👦🇮🇳',
      `nfc:${String.fromCodePoint(0xe9)}`, // é as one character
      `nfd:e${String.fromCodePoint(0x301)}`, // é as e + combining accent
      `ctrl:${String.fromCodePoint(0, 10, 0x2028)}`, // NUL, newline, line separator
      `lone:${String.fromCharCode(0xd800)}`, // lone surrogate
    ]
    const namespaces = ['naïve', '名前空間', '😀']
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe(channel)
    await waitForPath(bus1, bus2, channel)

    bus2.received.length = 0
    for (const namespace of namespaces) {
      await bus1.transport.publish(channel, { type: CacheBusMessageType.Delete, namespace, keys })
    }
    await until(() => bus2.received.length === namespaces.length)

    assert.deepEqual(
      bus2.received,
      namespaces.map(namespace => ({
        channel,
        message: { type: CacheBusMessageType.Delete, namespace, keys },
      })),
    )
    assert.deepEqual(bus1.errors, [])
    assert.deepEqual(bus2.errors, [])
  })

  test('splits messages with many keys across notifications', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    const keys = Array.from({ length: 3000 }, (_, i) => `product:${i}:`.padEnd(40, 'x'))
    await bus1.transport.publish('channel', message(keys, CacheBusMessageType.Delete))
    await until(() => bus2.received.flatMap(r => r.message.keys).length >= keys.length)

    assert.isAbove(bus2.received.length, 1)
    assert.deepEqual(
      bus2.received.flatMap(r => r.message.keys),
      keys,
    )
  })

  test('sends a message larger than one transaction over several', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    /**
     * About 4 MB of notifications, so at least 4 transactions
     */
    const keys = Array.from({ length: 100_000 }, (_, i) => `product:${i}:`.padEnd(40, 'x'))
    await bus1.transport.publish('channel', message(keys, CacheBusMessageType.Delete))
    await bus1.transport.publish('channel', message(['after']))
    await until(() => bus2.received.some(r => r.message.keys.includes('after')))

    const receivedKeys = bus2.received.flatMap(r => r.message.keys)
    assert.deepEqual(receivedKeys.slice(0, -1), keys)
    assert.deepEqual(bus1.errors, [])
  })

  test('keeps its listener when the server closes idle sessions', async ({ assert, cleanup }) => {
    /**
     * A heartbeat longer than the test keeps both connections idle. The
     * publishers may be closed and replaced; the listeners must stay.
     */
    const options = { heartbeat: { interval: '1m' } }
    const idleTimeout = { options: '-c idle_session_timeout=500' }
    const bus1 = createBus('bus-1', options, idleTimeout)
    const bus2 = createBus('bus-2', options, idleTimeout)
    cleanup(() => closeAll(bus1, bus2))

    const listenerPids = async () => {
      const result = await adminQuery(
        `SELECT pid FROM pg_stat_activity
         WHERE application_name = ANY($1) AND query LIKE 'LISTEN%' ORDER BY pid`,
        [[bus1.applicationName, bus2.applicationName]],
      )
      return result.rows
    }

    await bus1.subscribe('channel')
    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')
    const before = await listenerPids()

    await sleep(2000)
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')

    assert.lengthOf(before, 2)
    assert.deepEqual(await listenerPids(), before)
  })

  test('keeps its listener when an idle timeout is enabled by a config reload', async ({
    assert,
    cleanup,
  }) => {
    /**
     * Changes a server-wide setting, so it relies on tests running one at a
     * time. A session picks up a reloaded value on its next query, here the
     * LISTEN sent by a later subscribe.
     */
    cleanup(async () => {
      await adminQuery('ALTER SYSTEM RESET idle_session_timeout')
      await adminQuery('SELECT pg_reload_conf()')
    })

    const options = { heartbeat: { interval: '1m' } }
    const bus1 = createBus('bus-1', options)
    const bus2 = createBus('bus-2', options)
    cleanup(() => closeAll(bus1, bus2))

    const listenerPids = async () => {
      const result = await adminQuery(
        `SELECT pid FROM pg_stat_activity
         WHERE application_name = ANY($1) AND query LIKE 'LISTEN%' ORDER BY pid`,
        [[bus1.applicationName, bus2.applicationName]],
      )
      return result.rows
    }

    await bus1.subscribe('channel')
    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')

    await adminQuery("ALTER SYSTEM SET idle_session_timeout = '500ms'")
    await adminQuery('SELECT pg_reload_conf()')
    await sleep(300)

    await bus1.subscribe('other')
    await bus2.subscribe('other')
    await waitForPath(bus1, bus2, 'other')
    await waitForPath(bus2, bus1, 'other')
    const before = await listenerPids()

    await sleep(2000)
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')

    assert.lengthOf(before, 2)
    assert.deepEqual(await listenerPids(), before)
  })

  test('merges concurrent publishes into one message', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    const keys = Array.from({ length: 500 }, (_, i) => `key:${i}`)
    await Promise.all(keys.map(key => bus1.transport.publish('channel', message([key]))))
    await until(() => bus2.received.length > 0)
    await sleep(100)

    assert.deepEqual(bus2.received, [{ channel: 'channel', message: message(keys) }])
  })

  test('merges by type and namespace, deduplicates keys and keeps first-seen order', async ({
    assert,
    cleanup,
  }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    const { Set: SET, Delete: DELETE, Clear: CLEAR } = CacheBusMessageType
    const published: CacheBusMessage[] = [
      { type: SET, namespace: 'users', keys: ['a', 'b'] },
      { type: DELETE, namespace: 'users', keys: ['c'] },
      { type: SET, namespace: 'users', keys: ['b', 'd'] },
      { type: SET, namespace: 'posts', keys: ['e'] },
      { type: CLEAR, namespace: 'users', keys: [] },
      { type: CLEAR, namespace: 'users', keys: [] },
    ]
    await Promise.all(published.map(m => bus1.transport.publish('channel', m)))
    await until(() => bus2.received.length >= 4)
    await sleep(100)

    assert.deepEqual(
      bus2.received.map(r => r.message),
      [
        { type: SET, namespace: 'users', keys: ['a', 'b', 'd'] },
        { type: DELETE, namespace: 'users', keys: ['c'] },
        { type: SET, namespace: 'posts', keys: ['e'] },
        { type: CLEAR, namespace: 'users', keys: [] },
      ],
    )
  })

  test('waits batchDelay after the first message of a batch', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1', { batchDelay: '500ms' })
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    const start = Date.now()
    const first = bus1.transport.publish('channel', message(['first']))
    await sleep(100)
    const second = bus1.transport.publish('channel', message(['second']))
    await Promise.all([first, second])
    await until(() => bus2.received.length > 0)
    const elapsed = Date.now() - start
    await sleep(100)

    assert.isAtLeast(elapsed, 450)
    assert.deepEqual(bus2.received, [{ channel: 'channel', message: message(['first', 'second']) }])
  })

  test('sends a full batch without waiting for batchDelay', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1', { batchDelay: '20s', heartbeat: false })
    const bus2 = createBus('bus-2')
    const probe = createBus('probe')
    cleanup(() => closeAll(bus1, bus2, probe))

    /**
     * Probing from bus1 would wait 20s per attempt
     */
    await bus2.subscribe('channel')
    await waitForPath(probe, bus2, 'channel')
    await until(() => bus1.reconnects === 1)
    bus2.received.length = 0

    const keys = Array.from({ length: MAX_NOTIFICATIONS_PER_TRANSACTION }, (_, i) => `key:${i}`)
    await Promise.all(keys.map(key => bus1.transport.publish('channel', message([key]))))
    await until(() => bus2.received.flatMap(r => r.message.keys).length === keys.length, 10_000)
    assert.deepEqual(
      bus2.received.flatMap(r => r.message.keys),
      keys,
    )
  })

  test('escapes quotes and backslashes in channels, namespaces and keys', async ({
    assert,
    cleanup,
  }) => {
    const channel = String.raw`bentocache.notifications:o'brien\x"y`
    const keys = [`'; DROP TABLE x; --`, String.raw`back\slash`, `"double"`, String.raw`\'`]
    const namespace = String.raw`ns'\"`
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe(channel)
    await waitForPath(bus1, bus2, channel)
    bus2.received.length = 0

    await bus1.transport.publish(channel, { type: CacheBusMessageType.Delete, namespace, keys })
    await until(() => bus2.received.length === 1)

    assert.deepEqual(bus2.received, [
      { channel, message: { type: CacheBusMessageType.Delete, namespace, keys } },
    ])
    assert.deepEqual(bus1.errors, [])
  })

  test('rejects every merged publish when the publisher is lost', async ({ assert, cleanup }) => {
    const bus = createBus('bus-1', { batchDelay: '5s', heartbeat: false })
    cleanup(() => bus.transport.disconnect())
    await until(() => bus.reconnects === 1)

    const results = Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => bus.transport.publish('channel', message([`key:${i}`]))),
    )
    await adminQuery(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1',
      [bus.applicationName],
    )

    const settled = await results
    assert.lengthOf(settled, 20)
    assert.isTrue(settled.every(result => result.status === 'rejected'))
  })

  test('sends pending publishes when disconnect is called twice at once', async ({
    assert,
    cleanup,
  }) => {
    const bus1 = createBus('bus-1', { batchDelay: '5s', heartbeat: false })
    const bus2 = createBus('bus-2')
    const probe = createBus('probe')
    cleanup(() => closeAll(bus2, probe))

    await bus2.subscribe('channel')
    await waitForPath(probe, bus2, 'channel')
    await until(() => bus1.reconnects === 1)
    bus2.received.length = 0

    const keys = ['a', 'b', 'c', 'd', 'e']
    const outcomes = keys.map(key =>
      bus1.transport.publish('channel', message([key])).then(
        () => 'resolved',
        (error: Error) => error.message,
      ),
    )
    await Promise.all([bus1.transport.disconnect(), bus1.transport.disconnect()])

    assert.deepEqual(
      await Promise.all(outcomes),
      keys.map(() => 'resolved'),
    )
    await until(() => bus2.received.length === 1)
    assert.deepEqual(bus2.received, [{ channel: 'channel', message: message(keys) }])
  })

  test('is not delayed by a wall clock that goes back', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1', { heartbeat: false })
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    /**
     * Every read of the wall clock returns a time a minute earlier than
     * the previous one
     */
    const realNow = Date.now
    let fakeNow = realNow()
    Date.now = () => (fakeNow -= 60_000)
    cleanup(() => {
      Date.now = realNow
    })

    const publishes = Promise.all(
      ['a', 'b', 'c'].map(key => bus1.transport.publish('channel', message([key]))),
    )
    const outcome = await Promise.race([
      publishes.then(() => 'sent'),
      sleep(2000).then(() => 'stuck'),
    ])
    Date.now = realNow

    assert.equal(outcome, 'sent')
    await until(() => bus2.received.flatMap(r => r.message.keys).length === 3)
  })

  test('sends pending publishes before disconnecting', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1', { batchDelay: '5s', heartbeat: false })
    const bus2 = createBus('bus-2')
    const probe = createBus('probe')
    cleanup(() => closeAll(bus2, probe))

    await bus2.subscribe('channel')
    await waitForPath(probe, bus2, 'channel')
    await until(() => bus1.reconnects === 1)
    bus2.received.length = 0

    const start = Date.now()
    const outcome = bus1.transport.publish('channel', message(['last'])).then(
      () => 'resolved',
      (error: Error) => error.message,
    )
    await bus1.transport.disconnect()

    assert.equal(await outcome, 'resolved')
    assert.isBelow(Date.now() - start, 4000)
    await until(() => bus2.received.length === 1)
    assert.deepEqual(bus2.received, [{ channel: 'channel', message: message(['last']) }])
    await assert.rejects(
      () => bus1.transport.publish('channel', message(['after'])),
      'The Postgres bus is disconnected',
    )
  })

  test('replaces keys that are not strings with a clear of the namespace', async ({
    assert,
    cleanup,
  }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    const invalid = [[undefined], [42n], [Symbol('key')], 'not-an-array']
    for (const keys of invalid) {
      await bus1.transport.publish('channel', {
        type: CacheBusMessageType.Delete,
        namespace: 'users',
        keys,
      } as any)
    }
    const isProbe = (r: TestBus['received'][number]) =>
      r.message.keys.some(key => key.startsWith('probe:'))
    await until(() => bus2.received.some(r => !isProbe(r)))
    await sleep(100)

    const received = bus2.received.filter(r => !isProbe(r))
    assert.isNotEmpty(received)
    assert.isTrue(
      received.every(
        r => r.message.type === CacheBusMessageType.Clear && r.message.namespace === 'users',
      ),
    )
    assert.lengthOf(bus1.errors, invalid.length)
    assert.isTrue(bus1.errors.every(error => error.message.includes('not strings')))

    /**
     * `null` keys mean no keys, like a missing `keys`: a harmless no-op
     */
    bus2.received.length = 0
    await bus1.transport.publish('channel', {
      type: CacheBusMessageType.Delete,
      namespace: 'users',
      keys: null,
    } as any)
    await until(() => bus2.received.some(r => !isProbe(r)))
    assert.deepEqual(
      bus2.received.filter(r => !isProbe(r)).map(r => r.message),
      [{ type: CacheBusMessageType.Delete, namespace: 'users', keys: [] }],
    )
    assert.lengthOf(bus1.errors, invalid.length)
  })

  test('drops messages whose namespace is not a string', async ({ assert, cleanup }) => {
    const bus = createBus('bus-1')
    cleanup(() => bus.transport.disconnect())
    await until(() => bus.reconnects === 1)

    await bus.transport.publish('channel', {
      type: CacheBusMessageType.Delete,
      namespace: 42,
      keys: ['a'],
    } as any)

    assert.lengthOf(bus.errors, 1)
    assert.include(bus.errors[0].message, 'namespace is not a string')
  })

  test('stops delivering after unsubscribe', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')

    await bus2.transport.unsubscribe('channel')
    bus2.received.length = 0
    await bus1.transport.publish('channel', message(['after']))
    await sleep(300)

    assert.deepEqual(bus2.received, [])
  })

  test('reconnects both connections after they are terminated', async ({ assert, cleanup }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus1.subscribe('channel')
    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')

    await adminQuery(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1',
      [bus2.applicationName],
    )

    await until(() => bus2.errors.length > 0)
    await waitForPath(bus1, bus2, 'channel')
    await waitForPath(bus2, bus1, 'channel')

    assert.isAtLeast(bus2.reconnects, 2)
    assert.equal(await backendCount(bus2.applicationName), 2)
  })

  test('the heartbeat replaces a listener that silently stopped receiving', async ({
    assert,
    cleanup,
  }) => {
    const proxy = await createFreezableProxy()
    const bus1 = createBus('bus-1')
    const bus2 = createBus(
      'bus-2',
      { publishTimeout: 500, heartbeat: { interval: 200, timeout: 1000 } },
      { host: '127.0.0.1', port: proxy.port },
    )
    cleanup(async () => {
      await Promise.all([bus1.transport.disconnect(), bus2.transport.disconnect()])
      await proxy.close()
    })

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')

    proxy.freezeExisting()

    await until(
      () => bus2.errors.some(error => error.message.includes('did not receive a heartbeat')),
      10_000,
      'the heartbeat to detect the frozen listener',
    )
    await waitForPath(bus1, bus2, 'channel')

    assert.isTrue(bus2.errors.some(error => error.message.includes('timed out')))
    const heartbeatError = bus2.errors.find(error => error.message.includes('heartbeat'))!
    assert.include(heartbeatError.message, HEARTBEAT_DOCS_URL)
  })

  test('destroys connections that a stalled server never closes', async ({ assert, cleanup }) => {
    const clients = captureClients(cleanup)
    const proxy = await createFreezableProxy()
    const bus1 = createBus('bus-1')
    const bus2 = createBus(
      'bus-2',
      { publishTimeout: 500, heartbeat: { interval: 200, timeout: 1000 } },
      { host: '127.0.0.1', port: proxy.port },
    )
    cleanup(async () => {
      await closeAll(bus1, bus2)
      await proxy.close()
    })

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')

    const open = () =>
      clients.filter(client => client.port === proxy.port && !client.connection.stream.destroyed)

    /**
     * The heartbeat replaces both connections. Their sockets must not stay
     * open waiting for a server that never answers, or the process could
     * not exit.
     */
    const stalled = open()
    assert.lengthOf(stalled, 2)
    proxy.freezeExisting()
    await until(
      () => stalled.every(client => client.connection.stream.destroyed),
      10_000,
      'the stalled connections to be destroyed',
    )

    /**
     * The same on disconnect
     */
    await waitForPath(bus1, bus2, 'channel')
    const current = open()
    assert.lengthOf(current, 2)
    proxy.freezeExisting()
    await bus2.transport.disconnect()

    assert.isTrue(current.every(client => client.connection.stream.destroyed))
  })

  test('logs errors to the console when onError is not set, once a minute per message', async ({
    assert,
    cleanup,
  }) => {
    const logged: unknown[][] = []
    const consoleError = console.error
    console.error = (...args: unknown[]) => {
      logged.push(args)
    }

    const transport = postgresBusDriver({
      connection: { ...PG_CONNECTION, host: '127.0.0.1', port: 1 },
      heartbeat: false,
    })
      .factory(null)
      .setId('bus-1')
    cleanup(async () => {
      console.error = consoleError
      await transport.disconnect()
    })

    /**
     * Both connections fail and retry several times meanwhile, with the
     * same message
     */
    await until(() => logged.length > 0)
    await sleep(1500)

    assert.lengthOf(logged, 1)
    assert.equal(logged[0][0], '[bentocache] postgres bus error:')
    assert.match((logged[0][1] as Error).message, /ECONNREFUSED/)
  })

  test('names its sessions unless an application name is set', async ({ assert, cleanup }) => {
    const before = {
      listener: await backendCount('bentocache-bus:listener'),
      publisher: await backendCount('bentocache-bus:publisher'),
    }

    const unnamed = createBus('bus-1', {}, { application_name: undefined })
    const { user, password } = POSTGRES_CREDENTIALS
    const customName = `custom-${randomUUID().slice(0, 8)}`
    const named = postgresBusDriver({
      connection: `postgres://${user}:${password}@${PG_HOST}:${PG_PORT}/postgres?application_name=${customName}`,
      onError: () => {},
    })
      .factory(null)
      .setId('bus-2')
    cleanup(async () => {
      await Promise.all([unnamed.transport.disconnect(), named.disconnect()])
    })

    await until(
      async () =>
        (await backendCount('bentocache-bus:listener')) === before.listener + 1 &&
        (await backendCount('bentocache-bus:publisher')) === before.publisher + 1 &&
        (await backendCount(customName)) === 2,
      10_000,
      'the bus sessions to be named',
    )
    assert.equal(await backendCount('bentocache-bus:listener'), before.listener + 1)
  })

  test('reports refused connections with a readable message', async ({ assert, cleanup }) => {
    /**
     * `localhost` resolves to several addresses, so Node fails with an
     * AggregateError whose own message is empty
     */
    const bus = createBus('bus-1', {}, { host: 'localhost', port: 1 })
    cleanup(() => bus.transport.disconnect())

    await until(() => bus.errors.length >= 2)

    for (const error of bus.errors) {
      assert.match(error.message, /\S/)
    }
    assert.isTrue(bus.errors.some(error => error.message.includes('ECONNREFUSED')))
  })

  test('reports a key too long to send and clears its namespace instead', async ({
    assert,
    cleanup,
  }) => {
    const bus1 = createBus('bus-1')
    const bus2 = createBus('bus-2')
    cleanup(() => closeAll(bus1, bus2))

    await bus2.subscribe('channel')
    await waitForPath(bus1, bus2, 'channel')
    bus2.received.length = 0

    await bus1.transport.publish('channel', {
      type: CacheBusMessageType.Delete,
      namespace: 'users',
      keys: ['ok', 'x'.repeat(9000)],
    })

    await until(() => bus2.received.length === 1)
    assert.deepEqual(bus2.received[0].message, {
      type: CacheBusMessageType.Clear,
      namespace: 'users',
      keys: [],
    })
    assert.lengthOf(bus1.errors, 1)
    assert.include(bus1.errors[0].message, 'namespace "users" is cleared')
  })

  test('reports messages whose namespace is too long to send', async ({ assert, cleanup }) => {
    const bus = createBus('bus-1')
    cleanup(() => bus.transport.disconnect())
    await until(() => bus.reconnects === 1)

    await bus.transport.publish('channel', {
      type: CacheBusMessageType.Set,
      namespace: 'n'.repeat(9000),
      keys: ['a'],
    })

    assert.lengthOf(bus.errors, 1)
    assert.include(bus.errors[0].message, 'namespace is too long')
  })
})

test.group('Postgres bus | with BentoCache', group => {
  group.each.timeout(30_000)

  function createCache(applicationName: string) {
    return new BentoCache({
      default: 'cache',
      stores: {
        cache: bentostore()
          .useL1Layer(memoryDriver({}))
          .useBus(
            postgresBusDriver({
              connection: { ...PG_CONNECTION, application_name: applicationName },
            }),
          ),
      },
    })
  }

  test('invalidates other instances on set, delete and clear', async ({ assert, cleanup }) => {
    const applicationName = `bentocache-test-${randomUUID().slice(0, 8)}`
    const cache1 = createCache(applicationName)
    const cache2 = createCache(applicationName)
    cleanup(async () => {
      await Promise.all([cache1.disconnectAll(), cache2.disconnectAll()])
    })

    /**
     * Each store opens its two connections when it is first used
     */
    await cache1.get({ key: 'warmup' })
    await cache2.get({ key: 'warmup' })
    await until(async () => (await backendCount(applicationName)) === 4)

    const users1 = cache1.namespace('users')
    const users2 = cache2.namespace('users')

    /**
     * Retry until the listeners are ready: the first sets may be published
     * before the other instance listens
     */
    await until(async () => {
      await cache2.set({ key: 'foo', value: 'old' })
      await users2.set({ key: 'bar', value: 'old' })
      await cache1.set({ key: 'foo', value: 'new' })
      await users1.set({ key: 'bar', value: 'new' })
      await sleep(100)
      return (
        (await cache2.get({ key: 'foo' })) === undefined &&
        (await users2.get({ key: 'bar' })) === undefined
      )
    })

    await cache2.set({ key: 'foo', value: 'old' })
    await users2.set({ key: 'bar', value: 'old' })
    await cache1.delete({ key: 'foo' })
    await until(async () => (await cache2.get({ key: 'foo' })) === undefined)
    assert.equal(await users2.get({ key: 'bar' }), 'old')

    await users1.clear()
    await until(async () => (await users2.get({ key: 'bar' })) === undefined)
  })
})

test.group('Postgres bus | batching', () => {
  function queued(channel: string, count: number, payloadLength = 10): QueuedPublish {
    const notifications = Array.from({ length: count }, (_, i): Notification => [
      channel,
      `${i}`.padEnd(payloadLength, 'p'),
    ])
    return { notifications, sent: 0, resolve: () => {}, reject: () => {} }
  }

  test('puts several small messages in one transaction', ({ assert }) => {
    const queue = [queued('a', 2), queued('b', 3)]
    const { notifications, completed } = takeBatch(queue)

    assert.lengthOf(notifications, 5)
    assert.lengthOf(completed, 2)
    assert.lengthOf(queue, 0)
  })

  test('caps a transaction by notification count', ({ assert }) => {
    const queue = [queued('a', 700), queued('b', 700)]

    const first = takeBatch(queue, 1000)
    assert.lengthOf(first.notifications, 1000)
    assert.lengthOf(first.completed, 1)
    assert.equal(queue[0].sent, 300)

    const second = takeBatch(queue, 1000)
    assert.lengthOf(second.notifications, 400)
    assert.lengthOf(second.completed, 1)
    assert.lengthOf(queue, 0)
  })

  test('splits one large message by size and completes it with its last part', ({ assert }) => {
    const message = queued('channel', 2756, 7990)
    const next = queued('next', 1)
    const queue = [message, next]
    const batches = []

    while (queue.length > 0) batches.push(takeBatch(queue))

    for (const batch of batches) {
      const bytes = batch.notifications.reduce((sum, [c, p]) => sum + c.length + p.length, 0)
      assert.isAtMost(bytes, MAX_BYTES_PER_TRANSACTION)
      assert.isAtMost(batch.notifications.length, MAX_NOTIFICATIONS_PER_TRANSACTION)
    }

    assert.isAbove(batches.length, 20)
    assert.deepEqual(
      batches.flatMap(batch => batch.notifications),
      [...message.notifications, ...next.notifications],
    )
    assert.deepEqual(
      batches.flatMap(batch => batch.completed).map(item => item.notifications[0][0]),
      ['channel', 'next'],
    )
  })

  test('always takes at least one notification', ({ assert }) => {
    const queue = [queued('a', 2, 100)]
    const { notifications } = takeBatch(queue, 1000, 10)

    assert.lengthOf(notifications, 1)
    assert.equal(queue[0].sent, 1)
  })
})

test.group('Postgres bus | heartbeat stalls', () => {
  test('does not count a stall against heartbeats in flight', ({ assert }) => {
    /**
     * Committed at the 1,000 tick, then the process froze: the next 5 s
     * tick ran at 25,000 instead of 6,000. The heartbeat's age is the
     * 5,000 ms the process was running, not 24,000.
     */
    const inFlight = new Map([[7, 1000]])
    const lastTick = 1000
    const now = 25_000
    discountStall(inFlight, now - lastTick - 5000)

    assert.equal(now - inFlight.get(7)!, 5000)
  })

  test('leaves heartbeats alone when the timer fired on time or early', ({ assert }) => {
    const inFlight = new Map([[7, 1000]])
    discountStall(inFlight, 0)
    discountStall(inFlight, -3)

    assert.equal(inFlight.get(7), 1000)
  })

  test('checks heartbeats three times per timeout', ({ assert }) => {
    assert.equal(heartbeatCheckPeriod(15_000), 5000)
    assert.equal(heartbeatCheckPeriod(1000), 333)
    assert.equal(heartbeatCheckPeriod(1), 1)
  })
})

test.group('Postgres bus | options', () => {
  const connection = 'postgres://localhost/test'

  test('rejects durations that Node timers cannot represent', ({ assert }) => {
    const invalid: Array<Partial<PostgresBusConfig>> = [
      { publishTimeout: '30d' },
      { publishTimeout: 2 ** 31 },
      { publishTimeout: 0.5 },
      { publishTimeout: 0 },
      { publishTimeout: '0s' },
      { publishTimeout: 'abc' },
      { heartbeat: { interval: '30d' } },
      { heartbeat: { interval: 0.0001 } },
      { heartbeat: { timeout: '25d' } },
    ]

    for (const options of invalid) {
      assert.throws(
        () => postgresBusDriver({ connection, ...options }),
        /postgresBusDriver: ".+" must be a duration between 1ms and 2147483647ms/,
      )
    }
  })

  test('accepts the largest durations', ({ assert }) => {
    assert.doesNotThrow(() => postgresBusDriver({ connection, publishTimeout: 2 ** 31 - 1 }))
    assert.doesNotThrow(() => postgresBusDriver({ connection, heartbeat: { interval: '20d' } }))
  })

  test('accepts a batchDelay of 0 and rejects negative or too long ones', ({ assert }) => {
    assert.doesNotThrow(() => postgresBusDriver({ connection, batchDelay: 0 }))
    assert.doesNotThrow(() => postgresBusDriver({ connection, batchDelay: '1s' }))

    for (const batchDelay of [-1, '30d', 'abc']) {
      assert.throws(
        () => postgresBusDriver({ connection, batchDelay }),
        /postgresBusDriver: "batchDelay" must be a duration between 0ms and 2147483647ms/,
      )
    }
  })
})
