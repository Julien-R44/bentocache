import { Redis } from 'ioredis'
import { test } from '@japa/runner'
import { createId } from '@paralleldrive/cuid2'
import { setTimeout } from 'node:timers/promises'
import { GenericContainer } from 'testcontainers'

import { CacheBusMessageType } from '../../src/types/bus.js'
import { RedisBus } from '../../src/bus/drivers/redis_bus.js'
import { TestLogger } from '../../test_helpers/test_logger.js'
import { REDIS_CREDENTIALS } from '../../test_helpers/index.js'
import { JsonEncoder } from '../../src/bus/encoders/json_encoder.js'
import { BinaryEncoder } from '../../src/bus/encoders/binary_encoder.js'

test.group('Redis Bus', (group) => {
  group.tap((t) => t.retry(3))

  test('Bus1 should not receive message emitted by itself', async ({ assert, cleanup }) => {
    const bus1 = new RedisBus(REDIS_CREDENTIALS).setId(createId())
    cleanup(async () => bus1.disconnect())

    await bus1.subscribe('foo', () => {
      assert.fail('Bus1 should not receive message emitted by itself')
    })

    await bus1.publish('foo', { keys: ['foo'], type: CacheBusMessageType.Set })
    await setTimeout(1000)

    await bus1.publish('foo', { keys: ['foo'], type: CacheBusMessageType.Set })
    await setTimeout(1000)
  }).disableTimeout()

  test('bus 1 should receive message emitted by bus 2', async ({ assert, cleanup }, done) => {
    const bus1 = new RedisBus(REDIS_CREDENTIALS).setId(createId())
    const bus2 = new RedisBus(REDIS_CREDENTIALS).setId(createId())

    cleanup(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    const data = { keys: ['foo'], type: CacheBusMessageType.Set }

    bus1.subscribe('foo', (message) => {
      assert.deepInclude(message, data)
      done()
    })

    await bus2.publish('foo', data)
  }).waitForDone()

  test('json encoding/decoding should works fine', async ({ assert, cleanup }, done) => {
    const bus1 = new RedisBus(REDIS_CREDENTIALS, new JsonEncoder()).setId(createId())
    const bus2 = new RedisBus(REDIS_CREDENTIALS, new JsonEncoder()).setId(createId())

    cleanup(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    const data = {
      keys: ['foo', '1', '2', 'bar', 'key::test'],
      type: CacheBusMessageType.Set,
    }

    bus1.subscribe('foo', (message) => {
      assert.deepInclude(message, data)
      done()
    })

    await bus2.publish('foo', data)
  }).waitForDone()

  test('binary encoding/decoding should works fine', async ({ assert, cleanup }, done) => {
    const bus1 = new RedisBus(REDIS_CREDENTIALS, new BinaryEncoder()).setId(createId())
    const bus2 = new RedisBus(REDIS_CREDENTIALS, new BinaryEncoder()).setId(createId())

    cleanup(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    const data = {
      keys: ['foo', '1', '2', 'bar', 'key::test'],
      type: CacheBusMessageType.Set,
    }

    bus1.subscribe('foo', (message) => {
      assert.deepInclude(message, data)
      done()
    })

    await bus2.publish('foo', data)
  }).waitForDone()

  test('if invalid message is received it should not throw an error', async ({
    assert,
    cleanup,
  }) => {
    const testLogger = new TestLogger()

    const bus1 = new RedisBus(REDIS_CREDENTIALS, new BinaryEncoder())
      .setId(createId())
      .setLogger(testLogger)

    const redis = new Redis(REDIS_CREDENTIALS)

    cleanup(async () => {
      await bus1.disconnect()
      redis.disconnect()
    })

    bus1.subscribe('bentocache.notifications', () => assert.fail('Should not receive message'))
    await redis.publish('bentocache.notifications', 'invalid message')

    await setTimeout(1000)

    const log = testLogger.logs.find(
      (x) => x.level === 'warn' && x.msg === 'Invalid message received'
    )

    assert.isDefined(log)
  })

  test('trigger onReconnect when the redis client reconnects', async ({ assert, cleanup }) => {
    let container = await new GenericContainer('redis')
      .withExposedPorts({ container: 6379, host: 5643 })
      .start()

    const bus = new RedisBus({ port: 5643, host: 'localhost' }).setId(createId())

    cleanup(() => {
      bus.disconnect()
      container.stop()
    })

    let reconnectCalled = false
    bus.onReconnect(() => {
      if (reconnectCalled) return

      reconnectCalled = true
    })

    await container.restart()
    await setTimeout(200)

    assert.isTrue(reconnectCalled)
  })
})
