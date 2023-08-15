/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { BentoCacheOptions } from '../src/bento_cache_options.js'

test.group('Bento Cache Options', () => {
  test('default values', ({ assert }) => {
    const options = new BentoCacheOptions({})

    assert.deepEqual(options.ttl, '30m')
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
      duration: '6h',
      fallbackDuration: '10s',
    })
    assert.deepEqual(options.suppressRemoteCacheErrors, true)
  })
})
