import string from '@poppinss/utils/string'
import { test } from '@japa/runner'
import { CacheItemOptions } from '../../src/cache_options.js'

test.group('Cache Options', () => {
  test('override defaults', ({ assert }) => {
    const override = {
      ttl: '10m',
      gracefulRetain: { enabled: true, duration: '30m' },
    }

    const defaults = {
      ttl: '1h',
      gracefulRetain: { enabled: false, duration: '1h' },
    }

    const options = new CacheItemOptions(override, defaults)

    assert.equal(options.logicalTtl, string.milliseconds.parse('10m'))
    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('early expiration percentage', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      earlyExpiration: 0.1,
    })

    assert.equal(options.earlyExpireTtl, string.milliseconds.parse('1m'))
  })

  test('early expiration percentage with graceful retain', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      earlyExpiration: 0.1,
      gracefulRetain: { enabled: true, duration: '30m' },
    })

    assert.equal(options.earlyExpireTtl, string.milliseconds.parse('1m'))
  })

  test('physical ttl should be logical ttl when graceful retain is disabled', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
    })

    assert.equal(options.physicalTtl, string.milliseconds.parse('10m'))
  })

  test('physical ttl should be graceful retain ttl when graceful retain is enabled', ({
    assert,
  }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      gracefulRetain: { enabled: true, duration: '30m' },
    })

    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('null ttl should be kept and resolved to undefined', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: null,
      gracefulRetain: { enabled: true, duration: '30m' },
    })

    assert.deepEqual(options.logicalTtl, undefined)
  })

  test('clone with null ttl should be kept and resolved as undefined', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      gracefulRetain: { enabled: true, duration: '30m' },
    })

    const clone = options.cloneWith({ ttl: null })

    assert.deepEqual(clone.logicalTtl, undefined)
  })
})
