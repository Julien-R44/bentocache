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
    maxSize: 1000,
    prefix: 'japa',
  },
})

test.group('memory', (group) => {
  test('Should not exceed specified max size bytes', ({ assert }) => {
    const cache = new Memory({
      maxBytes: 1024,
    })

    const q1 = 'a'.repeat(1024)

    console.log(q1.length)
    console.log(q2.length)

    console.log(Buffer.byteLength(q1))
    console.log(Buffer.byteLength(q2))
  })
})
