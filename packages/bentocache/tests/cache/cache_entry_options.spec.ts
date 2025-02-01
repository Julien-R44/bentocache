import { test } from '@japa/runner'
import string from '@poppinss/utils/string'

import { CacheEntryOptions } from '../../src/cache/cache_entry/cache_entry_options.js'

test.group('Cache Entry Options', () => {
  test('override defaults', ({ assert }) => {
    const override = { ttl: '10m', grace: '30m' }
    const defaults = { ttl: '1h', grace: '1h' }

    const options = new CacheEntryOptions(override, defaults)

    assert.equal(options.logicalTtl, string.milliseconds.parse('10m'))
    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('physical ttl should be logical ttl when grace period is disabled', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: '10m' })

    assert.equal(options.physicalTtl, string.milliseconds.parse('10m'))
  })

  test('physical ttl should be grace period ttl when enabled', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: '10m', grace: '30m' })
    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('null ttl should be kept and resolved to undefined', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: null, grace: '30m' })
    assert.deepEqual(options.logicalTtl, undefined)
  })

  test('clone with null ttl should be kept and resolved as undefined', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: '10m', grace: '30m' })
    const clone = options.cloneWith({ ttl: null })

    assert.deepEqual(clone.logicalTtl, undefined)
  })

  test('should assign timeouts', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: '10m',
      timeout: '1m',
      hardTimeout: '2m',
    })

    assert.deepEqual(options.timeout, string.milliseconds.parse('1m'))
    assert.deepEqual(options.hardTimeout, string.milliseconds.parse('2m'))
  })

  test('should be able to override timeouts', ({ assert }) => {
    const options = new CacheEntryOptions({
      ttl: '10m',
      timeout: '1m',
      hardTimeout: '2m',
    })

    const clone = options.cloneWith({ timeout: '3m' })

    assert.deepEqual(clone.timeout, string.milliseconds.parse('3m'))
    assert.deepEqual(clone.hardTimeout, string.milliseconds.parse('2m'))
  })

  test('cloneWith should not mutate original', ({ assert }) => {
    const r1 = new CacheEntryOptions({ grace: false })
    const r2 = r1.cloneWith({ grace: '60m' })

    assert.isFalse(r1.isGraceEnabled)
    assert.isTrue(r2.isGraceEnabled)
  })

  test('timeout should be soft one if fallback value and grace period enabled', ({ assert }) => {
    const options = new CacheEntryOptions({ grace: '30m', timeout: '1m', hardTimeout: '2m' })

    assert.deepEqual(options.factoryTimeout(true), string.milliseconds.parse('1m'))
  })

  test('timeout should be hard one if fallback value but grace period disabled', ({ assert }) => {
    const options = new CacheEntryOptions({ grace: false, timeout: '1m', hardTimeout: '2m' })
    assert.deepEqual(options.factoryTimeout(true), string.milliseconds.parse('2m'))
  })

  test('timeout should be hard one if no fallback value and no grace period', ({ assert }) => {
    const options = new CacheEntryOptions({ grace: false, timeout: '1m', hardTimeout: '2m' })
    assert.deepEqual(options.factoryTimeout(false), string.milliseconds.parse('2m'))
  })

  test('no timeouts if not set', ({ assert }) => {
    const options = new CacheEntryOptions({})

    assert.isUndefined(options.timeout)
    assert.isUndefined(options.factoryTimeout(true))
    assert.isUndefined(options.factoryTimeout(false))
  })

  test('use default timeouts if not specified', ({ assert }) => {
    const options = new CacheEntryOptions({}, { timeout: '1m', hardTimeout: '2m' })

    assert.deepEqual(options.timeout, string.milliseconds.parse('1m'))
    assert.deepEqual(options.hardTimeout, string.milliseconds.parse('2m'))
  })

  test('override default timeouts', ({ assert }) => {
    const options = new CacheEntryOptions({ timeout: '1m' }, { timeout: '3m', hardTimeout: '4m' })

    assert.deepEqual(options.timeout, string.milliseconds.parse('1m'))
    assert.deepEqual(options.hardTimeout, string.milliseconds.parse('4m'))
  })

  test('setTtl should re-compute physical ttl', ({ assert }) => {
    const options = new CacheEntryOptions({ ttl: '10m' })

    options.setLogicalTtl(string.milliseconds.parse('5m'))

    assert.equal(options.logicalTtl, string.milliseconds.parse('5m'))
    assert.equal(options.physicalTtl, string.milliseconds.parse('5m'))
  })
})
