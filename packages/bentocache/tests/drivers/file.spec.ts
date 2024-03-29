import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'

import { File } from '../../src/drivers/file.js'
import { BASE_URL } from '../../test_helpers/index.js'
import { registerCacheDriverTestSuite } from '../../test_helpers/driver_test_suite.js'

test.group('File driver', (group) => {
  registerCacheDriverTestSuite({
    group,
    driver: File,
    config: { prefix: 'japa', directory: fileURLToPath(BASE_URL) },
  })
})
