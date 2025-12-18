import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory, slowFactory } from '../helpers/index.js'

test.group('One tier tests', () => {
  test('get() returns deserialized value', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: { foo: 'bar' } })
    assert.deepEqual(await cache.get({ key: 'key' }), { foo: 'bar' })

    await cache.set({ key: 'key', value: ['foo', 'bar'] })
    assert.deepEqual(await cache.get({ key: 'key' }), ['foo', 'bar'])

    await cache.set({ key: 'key', value: 1 })
    assert.deepEqual(await cache.get({ key: 'key' }), 1)

    await cache.set({ key: 'key', value: true })
    assert.deepEqual(await cache.get({ key: 'key' }), true)
  })

  test('get() returns null when null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: null })
    assert.isNull(await cache.get({ key: 'key' }))
  })

  test('get() with default value fallback', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const r1 = await cache.get({ key: 'key', defaultValue: 'default' })
    const r2 = await cache.get({ key: 'key', defaultValue: () => 'default' })

    assert.equal(r1, 'default')
    assert.equal(r2, 'default')
  })

  test('get() should assume array as a value and not a factory', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const r1 = await cache.get({ key: 'key1', defaultValue: ['a', 'b'] })
    const r2 = await cache.get({ key: 'key2', defaultValue: () => ['a', 'b'] })

    assert.deepEqual(r1, ['a', 'b'])
    assert.deepEqual(r2, ['a', 'b'])
  })

  test('get() with fallback but item found should return item', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: 'value' })
    const r1 = await cache.get({ key: 'key', defaultValue: 'default' })

    assert.equal(r1, 'value')
  })

  test('get() with grace period', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '4h' }).create()

    await cache.set({ key: 'key', value: 'value', ttl: '100ms' })
    await sleep(110)

    const r1 = await cache.get({ key: 'key' })
    const r2 = await cache.get({ key: 'key', defaultValue: undefined, grace: false })

    assert.deepEqual(r1, 'value')
    assert.isUndefined(r2)
  })

  test('get() with grace period and default value but no fallback value', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '4h' }).create()

    const result = await cache.get({
      key: 'key',
      defaultValue: 'default',
    })

    assert.equal(result, 'default')
  })

  test('get() should not use grace period when disabled', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: false }).create()

    await cache.getOrSet({
      key: 'key',
      ttl: '10ms',
      grace: '500ms',
      factory: () => 'value',
    })

    // we should get value
    const r1 = await cache.get({ key: 'key' })

    // wait til key expires
    await sleep(100)

    // we should not get value since grace period is disabled globally
    const r2 = await cache.get({ key: 'key' })

    // Otherwise if we had enabled grace period, we would get value
    const result = await cache.getOrSet({
      key: 'key',
      ttl: '10ms',
      grace: '500ms',
      factory: throwingFactory('DB call failed'),
    })

    assert.deepEqual(r1, 'value')
    assert.deepEqual(r2, undefined)
    assert.deepEqual(result, 'value')
  })

  test('missing() returns true when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    assert.isTrue(await cache.missing({ key: 'key1' }))
  })

  test('missing() returns false when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    assert.isFalse(await cache.missing({ key: 'key1' }))
  })

  test('missing() returns true if logically expired', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })

    await sleep(100)
    const r1 = await cache.missing({ key: 'key1' })

    await sleep(500)
    const r2 = await cache.missing({ key: 'key1' })

    assert.isTrue(r1)
    assert.isTrue(r2)
  })

  test('has() returns false when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    assert.isFalse(await cache.has({ key: 'key1' }))
  })

  test('has() returns true when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    assert.isTrue(await cache.has({ key: 'key1' }))
  })

  test('has() returns false if logically expired', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await sleep(100)

    const r1 = await cache.has({ key: 'key1' })

    await sleep(500)
    const r2 = await cache.has({ key: 'key1' })

    assert.isFalse(r1)
    assert.isFalse(r2)
  })

  test('clear() remove all keys', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await cache.set({ key: 'key2', value: 'bar' })
    await cache.namespace('users').set({ key: 'key3', value: 'blabla' })

    await cache.clear()

    assert.isFalse(await cache.has({ key: 'key1' }))
    assert.isFalse(await cache.has({ key: 'key2' }))
    assert.isFalse(await cache.namespace('users').has({ key: 'key3' }))
  })

  test('delete should delete key', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await cache.set({ key: 'key2', value: 'bar' })

    await sleep(100)

    await cache.delete({ key: 'key1' })
    await cache.delete({ key: 'key2' })

    assert.isFalse(await cache.has({ key: 'key1' }))
    assert.isFalse(await cache.has({ key: 'key2' }))
  })

  test('getMany() should return values for multiple keys in order', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    await cache.set({ key: 'key2', value: 'value2' })

    const results = await cache.getMany({ keys: ['key1', 'key2', 'key3'] })
    assert.deepEqual(results, ['value1', 'value2', undefined])

    const resultsWithDefault = await cache.getMany({ keys: ['key1', 'key3'], defaultValue: 'def' })
    assert.deepEqual(resultsWithDefault, ['value1', 'def'])
  })

  test('getMany() should return empty array for empty keys', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    const results = await cache.getMany({ keys: [] })
    assert.deepEqual(results, [])
  })

  test('getMany() should return all undefined for missing keys', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    const results = await cache.getMany({ keys: ['key1', 'key2'] })
    assert.deepEqual(results, [undefined, undefined])
  })

  test('getMany() should return defaults for all missing keys when defaultValue provided', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    const results = await cache.getMany({ keys: ['key1', 'key2'], defaultValue: 'default' })
    assert.deepEqual(results, ['default', 'default'])
  })

  test('getMany() should treat array defaultValue as a single value for each key', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    // 1. Array as value
    const r1 = await cache.getMany({
      keys: ['key1', 'key2'],
      defaultValue: ['a', 'b'],
    })

    // 2. Factory returning array
    const r2 = await cache.getMany({
      keys: ['key1', 'key2'],
      defaultValue: () => ['a', 'b'],
    })

    assert.deepEqual(r1, [
      ['a', 'b'],
      ['a', 'b'],
    ])
    assert.deepEqual(r2, [
      ['a', 'b'],
      ['a', 'b'],
    ])
  })

  test('getMany() should preserve order regardless of storage order', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'keyC', value: 'valueC' })
    await cache.set({ key: 'keyA', value: 'valueA' })
    await cache.set({ key: 'keyB', value: 'valueB' })

    const results = await cache.getMany({ keys: ['keyA', 'keyB', 'keyC'] })
    assert.deepEqual(results, ['valueA', 'valueB', 'valueC'])

    const resultsReverse = await cache.getMany({ keys: ['keyC', 'keyB', 'keyA'] })
    assert.deepEqual(resultsReverse, ['valueC', 'valueB', 'valueA'])

    const resultsMixed = await cache.getMany({ keys: ['keyB', 'keyA', 'keyC', 'keyA'] })
    assert.deepEqual(resultsMixed, ['valueB', 'valueA', 'valueC', 'valueA'])
  })

  test('getMany() should handle duplicate keys in request', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    await cache.set({ key: 'key2', value: 'value2' })

    const results = await cache.getMany({ keys: ['key1', 'key2', 'key1', 'key2', 'key1'] })
    assert.deepEqual(results, ['value1', 'value2', 'value1', 'value2', 'value1'])
  })

  test('getMany() should handle different data types correctly', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'string', value: 'text' })
    await cache.set({ key: 'number', value: 42 })
    await cache.set({ key: 'boolean', value: true })
    await cache.set({ key: 'array', value: [1, 2, 3] })
    await cache.set({ key: 'object', value: { foo: 'bar' } })
    await cache.set({ key: 'null', value: null })

    const results = await cache.getMany({
      keys: ['string', 'number', 'boolean', 'array', 'object', 'null', 'missing'],
    })

    assert.equal(results[0], 'text')
    assert.equal(results[1], 42)
    assert.equal(results[2], true)
    assert.deepEqual(results[3], [1, 2, 3])
    assert.deepEqual(results[4], { foo: 'bar' })
    assert.isNull(results[5])
    assert.isUndefined(results[6])
  })

  test('getMany() should call factory function for each missing key when used as defaultValue', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })

    let callCount = 0
    const factory = () => {
      callCount++
      return `default-${callCount}`
    }

    const results = await cache.getMany({
      keys: ['key1', 'key2', 'key3'],
      defaultValue: factory,
    })

    assert.deepEqual(results, ['value1', 'default-1', 'default-2'])
    assert.equal(callCount, 2)
  })

  test('getMany() should respect TTL and return undefined for expired items', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    await cache.set({ key: 'key2', value: 'value2', ttl: '50ms' })
    await cache.set({ key: 'key3', value: 'value3' })

    const results1 = await cache.getMany({ keys: ['key1', 'key2', 'key3'] })
    assert.deepEqual(results1, ['value1', 'value2', 'value3'])

    await sleep(100)

    const results2 = await cache.getMany({
      keys: ['key1', 'key2', 'key3'],
      defaultValue: 'expired',
    })
    assert.deepEqual(results2, ['value1', 'expired', 'value3'])
  })

  test('getMany() should handle grace period correctly with individual keys', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '50ms' })

    const results1 = await cache.getMany({ keys: ['key1'] })
    assert.deepEqual(results1, ['value1'])

    await sleep(100)

    const results2 = await cache.getMany({ keys: ['key1'] })
    assert.deepEqual(results2, ['value1'])

    await sleep(500)

    const results3 = await cache.getMany({ keys: ['key1'], defaultValue: 'default' })
    assert.deepEqual(results3, ['default'])
  })

  test('getMany() should return undefined after expiration when grace is disabled', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: false }).create()

    await cache.set({ key: 'key1', value: 'value1' })
    await cache.set({ key: 'key2', value: 'value2', ttl: '50ms' })

    await sleep(100)

    const results = await cache.getMany({
      keys: ['key1', 'key2'],
      defaultValue: 'default',
    })

    assert.deepEqual(results, ['value1', 'default'])
  })

  test('getMany() should isolate results between namespaces', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'root-value1' })
    await cache.namespace('users').set({ key: 'key1', value: 'users-value1' })
    await cache.namespace('users').set({ key: 'key2', value: 'users-value2' })

    const rootResults = await cache.getMany({ keys: ['key1', 'key2'] })
    assert.deepEqual(rootResults, ['root-value1', undefined])

    const usersResults = await cache.namespace('users').getMany({ keys: ['key1', 'key2'] })
    assert.deepEqual(usersResults, ['users-value1', 'users-value2'])
  })

  test('getMany() should handle large number of keys efficiently', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const numKeys = 100
    const keys = Array.from({ length: numKeys }, (_, i) => `key${i}`)

    for (let i = 0; i < numKeys / 2; i++) {
      await cache.set({ key: `key${i}`, value: `value${i}` })
    }

    const results = await cache.getMany({ keys })

    for (let i = 0; i < numKeys / 2; i++) {
      assert.equal(results[i], `value${i}`)
    }
    for (let i = numKeys / 2; i < numKeys; i++) {
      assert.isUndefined(results[i])
    }

    assert.lengthOf(results, numKeys)
  })

  test('getMany() should work correctly with concurrent set operations', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'initial1' })
    await cache.set({ key: 'key2', value: 'initial2' })

    const [getResults] = await Promise.all([
      cache.getMany({ keys: ['key1', 'key2', 'key3'] }),
      (async () => {
        await cache.set({ key: 'key3', value: 'concurrent3' })
      })(),
    ])

    assert.isArray(getResults)
    assert.lengthOf(getResults, 3)

    const finalResults = await cache.getMany({ keys: ['key1', 'key2', 'key3'] })
    assert.deepEqual(finalResults, ['initial1', 'initial2', 'concurrent3'])
  })

  test('getMany() should handle mixed valid and expired keys correctly', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    await cache.set({ key: 'key2', value: 'value2', ttl: '50ms' })
    await cache.set({ key: 'key3', value: 'value3' })
    await cache.set({ key: 'key4', value: 'value4', ttl: '50ms' })

    await sleep(100)

    const results = await cache.getMany({
      keys: ['key1', 'key2', 'key3', 'key4'],
      defaultValue: 'default',
    })

    assert.deepEqual(results, ['value1', 'default', 'value3', 'default'])
  })

  test('getMany() should not mutate input keys array', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })

    const keys = ['key1', 'key2']
    const keysCopy = [...keys]

    await cache.getMany({ keys })

    assert.deepEqual(keys, keysCopy)
  })

  test('deleteMany should delete multiple keys', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await cache.set({ key: 'key2', value: 'bar' })

    await sleep(100)

    await cache.deleteMany({ keys: ['key1', 'key2'] })

    assert.isFalse(await cache.has({ key: 'key1' }))
    assert.isFalse(await cache.has({ key: 'key2' }))
  })

  test('getOrSet() should returns null if null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: null })

    const value = await cache.getOrSet({
      key: 'key',
      factory: throwingFactory('shouldnt be called'),
    })
    assert.isNull(value)
  })

  test('getOrSetForever() should set value forever', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ ttl: 100 }).create()

    await cache.getOrSetForever({ key: 'key', factory: () => 'value' })
    assert.deepEqual(await cache.get({ key: 'key' }), 'value')

    await sleep(100)

    assert.deepEqual(await cache.get({ key: 'key' }), 'value')
  })

  test('getOrSetForever() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: { foo: 'bar' } })
    const r1 = await cache.getOrSetForever({
      key: 'key1',
      factory: throwingFactory('shouldnt be called'),
    })

    assert.deepEqual(r1, { foo: 'bar' })
  })

  test('getOrSetForever() store values when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const value = await cache.getOrSetForever({ key: 'key1', factory: () => ({ foo: 'bar' }) })
    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get({ key: 'key1' }), { foo: 'bar' })
  })

  test('setForever() store a value forever', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ ttl: 10 }).create()

    await cache.setForever({ key: 'key', value: 'value' })
    await sleep(30)
    assert.deepEqual(await cache.get({ key: 'key' }), 'value')
  })

  test('setForever() returns true when value is set', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const result = await cache.setForever({ key: 'key', value: 'value' })
    assert.isTrue(result)
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: { foo: 'bar' } })
    const value = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: { foo: 'bar' } })
    const value = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() store values when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const value = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get({ key: 'key1' }), { foo: 'bar' })
  })

  test('getOrSet() with specific ttl', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.getOrSet({ key: 'key1', ttl: '10ms', factory: () => ({ foo: 'bar' }) })
    await sleep(20)

    assert.isUndefined(await cache.get({ key: 'key1' }))
  })

  test('grace period should returns old value if factory throws', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory().withMemoryL1().merge({ ttl: 10, grace: '10m' }).create()

    const result = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    await sleep(100)
    const result2 = await cache.getOrSet({
      key: 'key1',
      factory: () => {
        // Since key1 is logically expired, this factory should be called
        assert.incrementAssertionsCount()
        throw new Error('foo')
      },
    })

    assert.deepEqual(result, { foo: 'bar' })
    assert.deepEqual(result2, { foo: 'bar' })
  })

  test('grace period should not returns old value if factory doesnt throws and soft timeout allows it', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 10, grace: '10m', timeout: '2s' })
      .create()

    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    await sleep(100)

    const r2 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'baz' })
  })

  test('should throws if graced value is now expired', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 10, grace: '100ms', timeout: '2s' })
      .create()

    // init cache
    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait til key is expired
    await sleep(50)

    // should returns graced value
    const r2 = await cache.getOrSet({ key: 'key1', factory: throwingFactory() })

    await sleep(300)

    // Graced value is now expired. Factory should be called
    const r3 = cache.getOrSet({ key: 'key1', factory: throwingFactory('Error in cb') })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    await assert.rejects(async () => r3, 'Factory has thrown an error')
  })

  test('if grace enabled with graceBackoff it should not try to call factory afterwards', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 10, grace: '6h', graceBackoff: '0.5s', timeout: '2s' })
      .create()

    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait til key is expired
    await sleep(50)

    // should returns graced value
    const r2 = await cache.getOrSet({ key: 'key1', factory: throwingFactory('Error in cb') })

    // this factory should not be called since graceBackoff is 5s
    let factory1Called = false
    const r3 = await cache.getOrSet({
      key: 'key1',
      factory: async () => {
        factory1Called = true
        throw new Error('should not be called')
      },
    })

    await sleep(800)

    // wait til graceBackoff is expired. Factory should be called
    const r4 = await cache.getOrSet({ key: 'key1', factory: async () => ({ foo: 'baz' }) })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    assert.deepEqual(r3, { foo: 'bar' })
    assert.deepEqual(r4, { foo: 'baz' })
    assert.isFalse(factory1Called)
  })

  test('soft timeout should returns old value if factory take too long', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 100, timeout: 500, grace: '10m' })
      .create()

    // init the cache
    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait for expiration
    await sleep(100)

    // factory that will exceed soft timeout
    const r2 = await cache.getOrSet({ key: 'key1', factory: slowFactory(550, { foo: 'baz' }) })

    // wait til factory is done
    await sleep(50)

    // get the value
    const r3 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bazzz' }) })

    assert.deepEqual(r1, r2)
    assert.deepEqual(r3, { foo: 'baz' })
  }).disableTimeout()

  test('should be able to specify a lock timeout', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ lockTimeout: 100 }).create()

    const r1 = cache.getOrSet({ key: 'key1', ttl: '10ms', factory: slowFactory(500, 'value') })
    const r2 = cache.getOrSet({ key: 'key1', ttl: '10ms', factory: throwingFactory() })

    const [result1, result2] = await Promise.allSettled([r1, r2])

    // @ts-ignore
    assert.deepEqual(result1.value, 'value')
    assert.equal(result2.status, 'rejected')
  })

  test('should not serialize l1 if serializeL1 is false', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1({ serialize: false }).withRedisL2().create()

    await cache.set({ key: 'foo', value: { date: new Date() } })
    const r1 = await cache.get({ key: 'foo' })
    const r2 = await cache.getOrSet({ key: 'bar', factory: () => ({ date: new Date() }) })
    const r3 = await cache.get({ key: 'bar' })

    assert.instanceOf(r1.date, Date)
    assert.instanceOf(r2.date, Date)
    assert.instanceOf(r3.date, Date)

    const { cache: cache2 } = new CacheFactory().withMemoryL1().withRedisL2().create()

    const r4 = await cache2.get({ key: 'foo' })
    assert.isString(r4.date)
  })

  test('has correct timestamp', async ({ assert }) => {
    const { local, cache, stack } = new CacheFactory().withMemoryL1().create()
    const testValue = { key: 'testKey', value: 'testValue' }

    await cache.set(testValue)
    const r1 = local.get(testValue.key, stack.defaultOptions)
    await sleep(100)
    const r2 = local.get(testValue.key, stack.defaultOptions)

    assert.isDefined(r1?.entry.getCreatedAt())
    assert.deepEqual(r1?.entry.getCreatedAt(), r2?.entry.getCreatedAt())
  })

  test('getOrSet() should execute factory when forceFresh is true', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    // First set a value
    await cache.set({ key: 'key1', value: 'initial', ttl: '1h' })

    // Then try to get it with forceFresh
    const value = await cache.getOrSet({
      key: 'key1',
      factory: () => 'updated',
      forceFresh: true,
    })

    assert.equal(value, 'updated')
    assert.equal(await cache.get({ key: 'key1' }), 'updated')
  })

  test('getOrSet() with forceFresh should execute factory even during grace period', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '1h' }).create()

    // Set initial value with short TTL
    await cache.getOrSet({
      key: 'key1',
      ttl: '10ms',
      factory: () => 'initial',
    })

    // Wait for TTL to expire, now we're in grace period
    await sleep(20)

    // Get with forceFresh should ignore grace period and execute factory
    const value = await cache.getOrSet({
      key: 'key1',
      factory: () => 'updated',
      forceFresh: true,
    })

    assert.equal(value, 'updated')
    assert.equal(await cache.get({ key: 'key1' }), 'updated')
  })

  test('getOrSet() with forceFresh should throw if factory throws', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '1h' }).create()

    // Set initial value
    await cache.set({ key: 'key1', value: 'initial' })

    // Get with forceFresh and throwing factory
    await assert.rejects(() =>
      cache.getOrSet({
        key: 'key1',
        factory: throwingFactory('forced error'),
        forceFresh: true,
      }),
    )

    // Original value should still be intact
    assert.equal(await cache.get({ key: 'key1' }), 'initial')
  })
})
