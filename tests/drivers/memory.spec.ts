/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { Memory } from '../../src/drivers/memory.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

registerApiTestSuite({
  test,
  driver: Memory,
  config: {
    maxItems: 1000,
    prefix: 'japa',
  },
})

test.group('memory', () => {
  test('should not store items exceeding maxEntrySize', async ({ assert }) => {
    const cache = new Memory({
      maxSize: 1024,
      maxEntrySize: 100,
    })

    const q1 = 'a'.repeat(100)
    const q2 = 'b'.repeat(101)

    cache.set('q1', q1)
    cache.set('q2', q2)

    const r1 = cache.get('q1')
    const r2 = cache.get('q2')

    assert.equal(r1, q1)
    assert.equal(r2, undefined)
  })

  test('should not exceed the store maxSize', async ({ assert }) => {
    const cache = new Memory({
      maxSize: 200,
    })

    const q1 = 'a'.repeat(100)
    const q2 = 'b'.repeat(100)
    const q3 = 'c'.repeat(100)

    cache.set('q1', q1)
    cache.set('q2', q2)
    cache.set('q3', q3)

    const r1 = cache.get('q1')
    const r2 = cache.get('q2')
    const r3 = cache.get('q3')

    assert.equal(r1, undefined)
    assert.equal(r2, q2)
    assert.equal(r3, q3)
  })
})
