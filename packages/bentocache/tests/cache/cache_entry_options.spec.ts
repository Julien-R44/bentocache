import { test } from '@japa/runner'
import string from '@poppinss/utils/string'

import { CacheEntryOptions } from '../../src/cache/cache_entry/cache_entry_options.js'

test.group('Cache Entry Options', () => {
  test('override defaults', ({ assert }) => {
    const override = { ttl: '10m', gracePeriod: { enabled: true, duration: '30m' } }
    const defaults = { ttl: '1h', gracePeriod: { enabled: false, duration: '1h' } }

    const options = new CacheEntryOptions(override, defaults)

    assert.equal(options.logicalTtl, string.milliseconds.parse('10m'))
    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('physical ttl should be logical ttl when grace period is disabled', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: '10m' })

    assert.equal(options.physicalTtl, string.milliseconds.parse('10m'))
  })

  test('physical ttl should be grace period ttl when enabled', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: '10m',
      gracePeriod: { enabled: true, duration: '30m' },
    })

    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('null ttl should be kept and resolved to undefined', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: null,
      gracePeriod: { enabled: true, duration: '30m' },
    })

    assert.deepEqual(options.logicalTtl, undefined)
  })

  test('clone with null ttl should be kept and resolved as undefined', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: '10m',
      gracePeriod: { enabled: true, duration: '30m' },
    })

    const clone = options.cloneWith({ ttl: null })

    assert.deepEqual(clone.logicalTtl, undefined)
  })

  test('should assign timeouts', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: '10m',
      timeouts: { soft: '1m', hard: '2m' },
    })

    assert.deepEqual(options.timeouts?.soft, string.milliseconds.parse('1m'))
    assert.deepEqual(options.timeouts?.hard, string.milliseconds.parse('2m'))
  })

  test('should be able to override timeouts', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: '10m',
      timeouts: { soft: '1m', hard: '2m' },
    })

    const clone = options.cloneWith({ timeouts: { soft: '3m' } })

    assert.deepEqual(clone.timeouts?.soft, string.milliseconds.parse('3m'))
    assert.deepEqual(clone.timeouts?.hard, string.milliseconds.parse('2m'))
  })

  test('cloneWith should not mutate original', ({ assert }) => {
    const r1 = new CacheEntryOptions({ gracePeriod: { enabled: false, duration: '30m' } })
    const r2 = r1.cloneWith({ gracePeriod: { enabled: true, duration: '60m' } })

    assert.isFalse(r1.isGracePeriodEnabled)
    assert.isTrue(r2.isGracePeriodEnabled)
  })

  test('timeout should be soft one if fallback value and grace period enabled', ({ assert }) => {
    const options = new CacheEntryOptions({
      gracePeriod: { enabled: true, duration: '30m' },
      timeouts: { soft: '1m', hard: '2m' },
    })

    assert.deepEqual(options.factoryTimeout(true), string.milliseconds.parse('1m'))
  })

  test('timeout should be hard one if fallback value but grace period disabled', ({ assert }) => {
    const options = new CacheEntryOptions({
      gracePeriod: { enabled: false, duration: '30m' },
      timeouts: { soft: '1m', hard: '2m' },
    })

    assert.deepEqual(options.factoryTimeout(true), string.milliseconds.parse('2m'))
  })

  test('timeout should be hard one if no fallback value and no grace period', ({ assert }) => {
    const options = new CacheEntryOptions({
      gracePeriod: { enabled: false, duration: '30m' },
      timeouts: { soft: '1m', hard: '2m' },
    })

    assert.deepEqual(options.factoryTimeout(false), string.milliseconds.parse('2m'))
  })

  test('no timeouts if not set', ({ assert }) => {
    const options = new CacheEntryOptions({})

    assert.isUndefined(options.timeouts)
    assert.isUndefined(options.factoryTimeout(true))
    assert.isUndefined(options.factoryTimeout(false))
  })

  test('use default timeouts if not specified', ({ assert }) => {
    const options = new CacheEntryOptions({}, { timeouts: { soft: '1m', hard: '2m' } })

    assert.deepEqual(options.timeouts, {
      soft: string.milliseconds.parse('1m'),
      hard: string.milliseconds.parse('2m'),
    })
  })

  test('override default timeouts', ({ assert }) => {
    const options = new CacheEntryOptions(
      { timeouts: { soft: '1m' } },
      { timeouts: { soft: '3m', hard: '4m' } },
    )

    assert.deepEqual(options.timeouts, {
      soft: string.milliseconds.parse('1m'),
      hard: string.milliseconds.parse('4m'),
    })
  })

  test('setTtl should re-compute physical ttl', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: '10m' })

    options.setLogicalTtl(string.milliseconds.parse('5m'))

    assert.equal(options.logicalTtl, string.milliseconds.parse('5m'))
    assert.equal(options.physicalTtl, string.milliseconds.parse('5m'))
  })
})
