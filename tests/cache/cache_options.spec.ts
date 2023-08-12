/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'
import { test } from '@japa/runner'
import { CacheItemOptions } from '../../src/cache/cache_item_options.js'

test.group('Cache Options', () => {
  test('override defaults', ({ assert }) => {
    const override = {
      ttl: '10m',
      gracePeriod: { enabled: true, duration: '30m' },
    }

    const defaults = {
      ttl: '1h',
      gracePeriod: { enabled: false, duration: '1h' },
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

  test('early expiration percentage with grace period', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      earlyExpiration: 0.1,
      gracePeriod: { enabled: true, duration: '30m' },
    })

    assert.equal(options.earlyExpireTtl, string.milliseconds.parse('1m'))
  })

  test('physical ttl should be logical ttl when grace period is disabled', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
    })

    assert.equal(options.physicalTtl, string.milliseconds.parse('10m'))
  })

  test('physical ttl should be grace period ttl when enabled', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      gracePeriod: { enabled: true, duration: '30m' },
    })

    assert.equal(options.physicalTtl, string.milliseconds.parse('30m'))
  })

  test('null ttl should be kept and resolved to undefined', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: null,
      gracePeriod: { enabled: true, duration: '30m' },
    })

    assert.deepEqual(options.logicalTtl, undefined)
  })

  test('clone with null ttl should be kept and resolved as undefined', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      gracePeriod: { enabled: true, duration: '30m' },
    })

    const clone = options.cloneWith({ ttl: null })

    assert.deepEqual(clone.logicalTtl, undefined)
  })

  test('should assign timeouts', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      timeouts: { soft: '1m', hard: '2m' },
    })

    assert.deepEqual(options.timeouts?.soft, string.milliseconds.parse('1m'))
    assert.deepEqual(options.timeouts?.hard, string.milliseconds.parse('2m'))
  })

  test('should be able to override timeouts', ({ assert }) => {
    const options = new CacheItemOptions({
      ttl: '10m',
      timeouts: { soft: '1m', hard: '2m' },
    })

    const clone = options.cloneWith({ timeouts: { soft: '3m' } })

    assert.deepEqual(clone.timeouts?.soft, string.milliseconds.parse('3m'))
    assert.deepEqual(clone.timeouts?.hard, string.milliseconds.parse('2m'))
  })

  test('cloneWith should not mutate original', ({ assert }) => {
    const r1 = new CacheItemOptions({
      gracePeriod: { enabled: false, duration: '30m' },
    })

    const r2 = r1.cloneWith({
      gracePeriod: { enabled: true, duration: '60m' },
    })

    assert.isFalse(r1.isGracePeriodEnabled)
    assert.isTrue(r2.isGracePeriodEnabled)
  })
})
