import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { sleep } from '@julr/utils/misc'

import { BASE_URL } from '../helpers/index.js'
import { FileDriver } from '../../src/drivers/file/file.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

test.group('File driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) => {
      return new FileDriver({ prefix: 'japa', directory: fileURLToPath(BASE_URL), ...options })
    },
  })
})

test.group('File Driver | Prune', () => {
  test('should prune expired items every x seconds', async ({ assert, fs, cleanup }) => {
    const driver = new FileDriver({
      pruneInterval: 500,
      directory: fileURLToPath(BASE_URL),
    })

    cleanup(() => driver.disconnect())

    await Promise.all([
      driver.set('foo', 'bar', 300),
      driver.set('foo2', 'bar', 300),
      driver.set('foo3:1', 'bar', 300),
      driver.set('foo4', 'bar', undefined),
    ])

    await sleep(1000)

    assert.isFalse(await fs.exists('foo'))
    assert.isFalse(await fs.exists('foo2'))
    assert.isFalse(await fs.exists('foo3/1'))
    assert.isTrue(await fs.exists('foo4'))
  })

  test('continue if invalid file is inside the cache directory', async ({
    assert,
    fs,
    cleanup,
  }) => {
    const driver = new FileDriver({
      pruneInterval: 500,
      directory: fileURLToPath(BASE_URL),
    })

    cleanup(() => driver.disconnect())

    await fs.create('foo', 'invalid content')

    await Promise.all([driver.set('foo2', 'bar', 300), driver.set('foo3:1', 'bar', 300)])

    await sleep(1000)

    assert.isTrue(await fs.exists('foo'))
    assert.isFalse(await fs.exists('foo2'))
    assert.isFalse(await fs.exists('foo3/1'))
  })

  test('should not write compromised data', async ({ cleanup, assert }) => {
    const driver = new FileDriver({
      pruneInterval: 500,
      directory: fileURLToPath(BASE_URL),
    })

    cleanup(() => driver.disconnect())

    await Promise.all([
      driver.set('foo', 'bar', 300),
      driver.set('foo', 'bar', undefined),
      driver.set('foo', 'dar', undefined),
      driver.set('foo', 'bar', 300),
      driver.set('foo', 'bar', 300),
      driver.set('foo', 'bar', undefined),
    ])

    await assert.doesNotReject(() => driver.get('foo'))
  })
})
