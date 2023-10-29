import { test } from '@japa/runner'

import { MemoryLru } from '../../src/drivers/lru.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

registerApiTestSuite({
  test,
  driver: MemoryLru,
  config: {
    maxSize: 1000,
    prefix: 'japa',
  },
})
