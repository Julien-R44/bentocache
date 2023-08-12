/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Redis } from '../../src/drivers/redis.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

registerApiTestSuite({
  name: 'Redis ( Upstash )',
  test,
  driver: Redis,
  config: {
    ttl: 30 * 100,
    prefix: 'japa',
    connection: {
      host: process.env.UPSTASH_HOST!,
      port: +process.env.UPSTASH_PORT!,
      username: process.env.UPSTASH_USERNAME!,
      password: process.env.UPSTASH_PASSWORD!,
    },
  },
})
