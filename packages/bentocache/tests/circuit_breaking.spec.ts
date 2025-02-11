import { mock } from 'node:test'
import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { NullDriver } from './helpers/null/null_driver.js'
import { CacheFactory } from '../factories/cache_factory.js'
import { CircuitBreaker } from '../src/circuit_breaker/index.js'

test.group('Circuit breaking', () => {
  test('Simple circuit breaker should works', async ({ assert }) => {
    const cb = new CircuitBreaker({ breakDuration: 400 })

    cb.open()
    cb.open()
    cb.open()

    assert.isTrue(cb.isOpen())
    await sleep(200)
    assert.isTrue(cb.isOpen())
    await sleep(210)
    assert.isFalse(cb.isOpen())
    assert.isTrue(cb.isClosed())
  })

  test('Circuit breaker should open when remote cache call fail', async ({ assert }) => {
    const get = mock.fn(() => {
      throw new Error('Unable to connect to remote cache')
    })

    class L2Driver extends NullDriver {
      type = 'l2' as const

      get() {
        return get()
      }
    }

    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ l2Driver: new L2Driver({}), l2CircuitBreakerDuration: '200ms' })
      .create()

    await cache.get({ key: 'foo' })
    await cache.get({ key: 'foo' })
    await cache.get({ key: 'foo' })

    assert.deepEqual(get.mock.callCount(), 1)

    // Wait for the circuit breaker to close
    await sleep(210)

    await cache.get({ key: 'foo' })

    assert.deepEqual(get.mock.callCount(), 2)
  }).disableTimeout()

  test('should not have circuit breaker if l2CircuitBreakerDuration is not set', async ({
    assert,
  }) => {
    const get = mock.fn(() => {
      throw new Error('Unable to connect to remote cache')
    })

    class L2Driver extends NullDriver {
      type = 'l2' as const

      get() {
        return get()
      }
    }

    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ l2Driver: new L2Driver({}) })
      .create()

    await cache.get({ key: 'foo' })
    await cache.get({ key: 'foo' })
    await cache.get({ key: 'foo' })

    assert.deepEqual(get.mock.callCount(), 3)
  })
})
