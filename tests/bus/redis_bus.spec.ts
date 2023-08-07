import { test } from '@japa/runner'
import { RedisBus } from '../../src/bus/drivers/redis_bus.js'
import { REDIS_CREDENTIALS } from '../../test_helpers/index.js'
import { CacheBusMessageType } from '../../src/types/bus.js'

test.group('Redis Bus', () => {
  test('Simple pub/sub', async ({ assert }, done) => {
    const a = new RedisBus(REDIS_CREDENTIALS)
    const b = new RedisBus(REDIS_CREDENTIALS)

    await a.subscribe('test', (message) => {
      assert.equal(message.id, 'test')
      assert.equal(message.type, CacheBusMessageType.Set)
      assert.deepEqual(message.keys, ['test'])
      done()
    })

    b.publish('test', {
      id: 'test',
      type: CacheBusMessageType.Set,
      keys: ['test'],
    })

    a.disconnect()
    b.disconnect()
  })
    .waitForDone()
    .timeout(1000)
})
