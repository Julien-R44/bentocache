/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'

import { File } from '../../src/drivers/file.js'
import { BASE_URL } from '../../test_helpers/index.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

registerApiTestSuite({
  test,
  driver: File,
  config: {
    ttl: 30 * 100,
    prefix: 'japa',
    directory: fileURLToPath(BASE_URL),
  },
})
