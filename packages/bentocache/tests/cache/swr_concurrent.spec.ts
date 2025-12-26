import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { CacheFactory } from '../../factories/cache_factory.js'

test.group('SWR with background revalidation', () => {
  test('timeout 0 should return stale immediately when factory is running in background', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 0, // SWR mode
      })
      .withL1L2Config()
      .create()

    // Set initial value and let it expire
    await cache.set({ key: 'key', value: 'stale value' })
    await sleep(150) // Wait for it to become stale

    let factoryCallCount = 0
    const slowFactory = async () => {
      const callNumber = ++factoryCallCount
      console.log(`Factory call ${callNumber} started`)
      await sleep(1000) // Slow factory
      console.log(`Factory call ${callNumber} completed`)
      return `fresh value ${callNumber}`
    }

    // First call - should return stale immediately and start background refresh
    console.log('Starting call 1...')
    const start1 = Date.now()
    const result1 = await cache.getOrSet({ key: 'key', factory: slowFactory })
    const elapsed1 = Date.now() - start1
    console.log(`Call 1 returned: ${elapsed1}ms, result: ${result1}`)

    // Wait a bit to ensure first call has returned but background factory is still running
    await sleep(100)
    console.log('Background factory should still be running...')

    // Second call - made while background factory from first call is STILL running
    console.log('Starting call 2...')
    const start2 = Date.now()
    const result2 = await cache.getOrSet({ key: 'key', factory: slowFactory })
    const elapsed2 = Date.now() - start2
    console.log(`Call 2 returned: ${elapsed2}ms, result: ${result2}`)

    // Both should return stale value
    assert.equal(result1, 'stale value', 'First call should return stale value')
    assert.equal(result2, 'stale value', 'Second call should also return stale value')

    // Both should be fast (< 100ms each)
    assert.isBelow(elapsed1, 100, `First call took ${elapsed1}ms`)
    assert.isBelow(
      elapsed2,
      100,
      `Second call took ${elapsed2}ms - BUG: waits for background factory!`,
    )

    // Factory should only be called once (stampede protection)
    assert.equal(factoryCallCount, 1, 'Factory should only be called once')

    // Wait for background refresh to complete
    await sleep(1100)

    // Now getting the value should return the fresh value
    const result3 = await cache.get({ key: 'key' })
    assert.equal(result3, 'fresh value 1')
  })

  test('lockTimeout should not prevent immediate return when timeout is 0', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 0,
        lockTimeout: 5000, // <-- THE BUG: This overrides timeout: 0
      })
      .withL1L2Config()
      .create()

    // Set stale value
    await cache.set({ key: 'key', value: 'stale value' })
    await sleep(150)

    let factoryCallCount = 0

    // Start first call (starts background factory, holds lock for ~2000ms)
    const start1 = Date.now()
    const promise1 = cache.getOrSet({
      key: 'key',
      factory: async () => {
        const callNum = ++factoryCallCount
        console.log(`[${Date.now()}] Factory call #${callNum} started, will hold lock for 2000ms`)
        await sleep(2000)
        console.log(`[${Date.now()}] Factory call #${callNum} completed`)
        return `factory-call-${callNum}`
      },
    })
    const result1 = await promise1
    const elapsed1 = Date.now() - start1
    console.log(`[${Date.now()}] First call completed in ${elapsed1}ms, got: "${result1}"`)

    // Second call - made after first has returned, while background factory is still running
    // Expected: Should return stale immediately
    // Bug: With lockTimeout: 5000, it waits for the lock instead
    const start2 = Date.now()
    console.log(`[${start2}] Starting second call immediately...`)

    const result2 = await cache.getOrSet({
      key: 'key',
      factory: async () => {
        const callNum = ++factoryCallCount
        console.log(`Factory call #${callNum} called - THIS SHOULD NOT HAPPEN!`)
        return `factory-call-${callNum}`
      },
    })

    const elapsed2 = Date.now() - start2
    console.log(`[${Date.now()}] Second call completed in ${elapsed2}ms, got: "${result2}"`)

    // Both should return the same stale value
    assert.equal(result1, 'stale value', 'First call should return stale value')
    assert.equal(result2, 'stale value', 'Second call should also return stale value')

    // THE BUG: With lockTimeout: 5000, the second call will wait close to 2000ms
    // Expected: < 100ms (returns stale immediately)
    // Actual: ~2000ms (waits for lock to be released)
    console.log(`\n🐛 BUG CHECK:`)
    console.log(`- If elapsed2 is ~2000ms: BUG EXISTS (waited for lock)`)
    console.log(`- If elapsed2 is <100ms: BUG FIXED (returned stale immediately)`)
    console.log(`- Actual elapsed2: ${elapsed2}ms`)

    assert.isBelow(
      elapsed2,
      100,
      `BUG CONFIRMED! Second call took ${elapsed2}ms instead of <100ms. It waited for the lock instead of returning stale immediately!`,
    )

    // Factory should only be called once
    assert.equal(factoryCallCount, 1, 'Factory should only be called once')

    console.log(`\nSummary:`)
    console.log(`- First call: ${elapsed1}ms, returned: "${result1}"`)
    console.log(`- Second call: ${elapsed2}ms, returned: "${result2}"`)
    console.log(`- Factory was called: ${factoryCallCount} time(s)`)
  }).timeout(10_000)
})
