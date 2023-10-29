import { test } from '@japa/runner'

import { Locks } from '../src/cache/locks.js'

test.group('Locks', () => {
  test('Lock timeout should works', async ({ assert }) => {
    const locks = new Locks()

    const lock1 = locks.getOrCreateForKey('key1')
    await lock1.acquire()

    const lock2 = locks.getOrCreateForKey('key1', 1000)

    await assert.rejects(async () => {
      await lock2.acquire()
    }, 'timeout while waiting for mutex to become available')
  })
})
