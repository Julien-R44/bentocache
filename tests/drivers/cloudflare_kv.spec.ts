/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { CloudflareKv } from '../../src/drivers/cloudflare_kv.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'
import { cloudflareMockServer } from '../../test_helpers/cloudflare_mock_server.js'

registerApiTestSuite({
  test,
  driver: CloudflareKv,
  supportsMilliseconds: false,

  setup: () => cloudflareMockServer.listen(),
  teardown: () => cloudflareMockServer.close(),

  config: {
    ttl: 30 * 100,
    prefix: 'japa',
    ignoreMinTtlError: true,
    accountId: process.env.CF_ACCOUNT_ID!,
    namespaceId: process.env.CF_NAMESPACE_ID!,
    apiToken: process.env.CF_API_TOKEN!,
  },
})
