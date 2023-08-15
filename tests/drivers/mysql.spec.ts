/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'
import { Mysql } from '../../src/drivers/sql/mysql.js'

registerApiTestSuite({
  test,
  driver: Mysql,
  supportsMilliseconds: false,
  config: {
    prefix: 'japa',
    connection: {
      user: 'root',
      password: 'root',
      database: 'mysql',
      port: 3306,
    },
  },
})
