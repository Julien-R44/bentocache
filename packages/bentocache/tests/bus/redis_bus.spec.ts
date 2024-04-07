import { test } from '@japa/runner'
import { createId } from '@paralleldrive/cuid2'
import { setTimeout } from 'node:timers/promises'
import { RedisTransport } from '@rlanz/bus/transports/redis'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { CacheBusMessageType } from '../../src/types/bus.js'
import { BinaryEncoder } from '../../src/bus/encoders/binary_encoder.js'

test.group('Redis Bus', (group) => {
  group.tap((t) => t.retry(3))

  test('Bus1 should not receive message emitted by itself', async ({ assert, cleanup }) => {
    const bus1 = new RedisTransport(REDIS_CREDENTIALS).setId(createId())
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
    const bus1 = new RedisTransport(REDIS_CREDENTIALS).setId(createId())
    const bus2 = new RedisTransport(REDIS_CREDENTIALS).setId(createId())

    cleanup(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    const data = { keys: ['foo'], type: CacheBusMessageType.Set }

    bus1.subscribe('foo', (message: any) => {
      assert.deepInclude(message, data)
      done()
    })

    await bus2.publish('foo', data)
  }).waitForDone()

  test('binary encoding/decoding should works fine', async ({ assert, cleanup }, done) => {
    const bus1 = new RedisTransport(REDIS_CREDENTIALS, new BinaryEncoder()).setId(createId())
    const bus2 = new RedisTransport(REDIS_CREDENTIALS, new BinaryEncoder()).setId(createId())

    cleanup(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    const data = {
      keys: ['foo', '1', '2', 'bar', 'key::test'],
      type: CacheBusMessageType.Set,
    }

    bus1.subscribe('foo', (message: any) => {
      assert.deepInclude(message, data)
      done()
    })

    await bus2.publish('foo', data)
  }).waitForDone()
})
