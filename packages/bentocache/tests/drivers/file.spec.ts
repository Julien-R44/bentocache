import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { sleep } from '@julr/utils/misc'
import { testLogger } from '@julr/utils/logger'

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

  test('delete corrupted cache files (invalid JSON) during prune', async ({
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

    assert.isFalse(await fs.exists('foo'))
    assert.isFalse(await fs.exists('foo2'))
    assert.isFalse(await fs.exists('foo3/1'))
  })

  test('delete empty cache files during prune', async ({ assert, fs, cleanup }) => {
    const driver = new FileDriver({
      pruneInterval: 500,
      directory: fileURLToPath(BASE_URL),
    })

    cleanup(() => driver.disconnect())

    await fs.create('emptyFile', '')
    await driver.set('validKey', 'bar', 300)

    await sleep(1000)

    assert.isFalse(await fs.exists('emptyFile'))
    assert.isFalse(await fs.exists('validKey'))
  })

  test('use configured logger', async ({ assert, fs, cleanup }) => {
    const logger = testLogger()
    const driver = new FileDriver({
      pruneInterval: 500,
      directory: fileURLToPath(BASE_URL),
      // @ts-ignore
      logger: logger as any,
    })

    cleanup(() => driver.disconnect())

    await fs.create('foo', 'invalid content')
    await Promise.all([driver.set('foo2', 'bar', 300), driver.set('foo3:1', 'bar', 300)])
    await sleep(1000)

    assert.deepEqual(logger.logs.length, 2)
    assert.deepEqual(logger.logs[0].level, 'error')
    assert.deepEqual(logger.logs[0].msg, 'failed to prune expired items')
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

  test('prune manually using prune() method', async ({ assert, fs, cleanup }) => {
    const driver = new FileDriver({
      directory: fileURLToPath(BASE_URL),
    })

    cleanup(() => driver.disconnect())

    await Promise.all([
      driver.set('foo', 'bar', 300),
      driver.set('foo2', 'bar', 300),
      driver.set('foo3:1', 'bar', 300),
      driver.set('foo4', 'bar', undefined),
    ])

    assert.isTrue(await fs.exists('foo'))
    assert.isTrue(await fs.exists('foo2'))
    assert.isTrue(await fs.exists('foo3/1'))
    assert.isTrue(await fs.exists('foo4'))

    await sleep(1000)
    await driver.prune()

    assert.isFalse(await fs.exists('foo'))
    assert.isFalse(await fs.exists('foo2'))
    assert.isFalse(await fs.exists('foo3/1'))
    assert.isTrue(await fs.exists('foo4'))
  })
})
