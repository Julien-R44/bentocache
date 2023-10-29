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
