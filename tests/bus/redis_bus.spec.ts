/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Redis } from 'ioredis'
import { test } from '@japa/runner'
import { createId } from '@paralleldrive/cuid2'
import { setTimeout } from 'node:timers/promises'

import { CacheBusMessageType } from '../../src/types/bus.js'
import { RedisBus } from '../../src/bus/drivers/redis_bus.js'
import { TestLogger } from '../../test_helpers/test_logger.js'
import { REDIS_CREDENTIALS } from '../../test_helpers/index.js'
import { JsonEncoder } from '../../src/bus/encoders/json_encoder.js'
import { BinaryEncoder } from '../../src/bus/encoders/binary_encoder.js'

test.group('Redis Bus', () => {
  test('Bus1 should not receive message emitted by itself', async ({ assert, cleanup }) => {
    const bus1 = new RedisBus(REDIS_CREDENTIALS).setId(createId())
    cleanup(async () => bus1.disconnect())

    bus1.subscribe('foo', () => {
      console.log('Bus1 received message emitted by itself')
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
})
