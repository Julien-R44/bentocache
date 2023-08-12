/*
 * @quakjs/bentocache
 *
 * (c) Quak
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
    ttl: 30 * 100,
    maxSize: 1000,
    prefix: 'japa',
  },
})
