import { test } from '@japa/runner'
import { Redis } from '../src/drivers/redis.js'

test.group('Keyv driver', (group) => {
  let redis: Redis

  group.each.setup(async () => {
    redis = new Redis({})

    return async () => {
      await redis.clear()
      await redis.disconnect()
    }
  })

  test('put()', async ({ assert }) => {
    await redis.put('key', 3)

    const result = await redis.get('key')
    assert.equal(result, 3)
  })

  test('get()', async ({ assert }) => {
    await redis.put('key', 42)
    const result = await redis.get('key')
    assert.equal(result, 42)

    const result2 = await redis.get('key2')
    assert.equal(result2, null)
  })

  test('get() with default value', async ({ assert }) => {
    const result = await redis.get('key', 42)
    assert.equal(result, 42)
  })

  test('get() with default value but found key', async ({ assert }) => {
    await redis.put('key', 3)
    const result = await redis.get('key', 42)
    assert.equal(result, 3)
  })

  test('get() with default value cb', async ({ assert }) => {
    const result = await redis.get('key', () => 42)
    assert.equal(result, 42)
  })

  test('get() with async default value cb', async ({ assert }) => {
    const result = await redis.get('key', async () => 42)
    assert.equal(result, 42)
  })

  test('clear()', async ({ assert }) => {
    await redis.put('key', 3)
    await redis.put('key2', 3)

    await redis.clear()

    const result = await redis.get('key')
    const result2 = await redis.get('key2')

    assert.equal(result, null)
    assert.equal(result2, null)
  })

  test('has()', async ({ assert }) => {
    await redis.put('yoyo', 3)

    const result = await redis.has('yoyo')
    const result2 = await redis.has('yoyo2')

    assert.isTrue(result)
    assert.isFalse(result2)
  })
})
