/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Postgres } from '../../src/drivers/sql/postgres.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

registerApiTestSuite({
  test,
  driver: Postgres,
  config: {
    prefix: 'japa',
    connection: { user: 'postgres', password: 'postgres' },
  },
})
