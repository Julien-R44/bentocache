import { test } from '@japa/runner'
import string from '@poppinss/utils/string'

import { BentoCacheOptions } from '../src/bento_cache_options.js'

test.group('Bento Cache Options', () => {
  test('default values', ({ assert }) => {
    const options = new BentoCacheOptions({})

    assert.deepEqual(options.ttl, string.milliseconds.parse('30m'))
    assert.deepEqual(options.prefix, 'bentocache')
    assert.deepEqual(options.suppressRemoteCacheErrors, true)
  })

  test('override defaults', ({ assert }) => {
    const options = new BentoCacheOptions({ ttl: '10m', prefix: 'foo' })

    assert.deepEqual(options.ttl, '10m')
    assert.deepEqual(options.prefix, 'foo')
    assert.deepEqual(options.suppressRemoteCacheErrors, true)
  })

  test('override with cloneWith', ({ assert }) => {
    const options = new BentoCacheOptions({ ttl: '10m', prefix: 'foo' }).cloneWith({ ttl: '20m' })

    assert.deepEqual(options.ttl, '20m')
    assert.deepEqual(options.prefix, 'foo')
    assert.deepEqual(options.gracePeriod, {
      enabled: false,
      duration: string.milliseconds.parse('6h'),
      fallbackDuration: string.milliseconds.parse('10s'),
    })
    assert.deepEqual(options.suppressRemoteCacheErrors, true)
  })
})
