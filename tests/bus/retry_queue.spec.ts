/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { RetryQueue } from '../../src/bus/retry_queue.js'
import { CacheBusMessageType } from '../../src/types/bus.js'

test.group('RetryQueue', () => {
  test('Does not insert duplicates', ({ assert }) => {
    const queue = new RetryQueue()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Set,
      keys: ['foo'],
    })

    const r1 = queue.size()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Set,
      keys: ['foo'],
    })

    const r2 = queue.size()

    assert.equal(r1, r2)
  })

  test('Does not insert duplicates ( different keys orders )', ({ assert }) => {
    const queue = new RetryQueue()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Set,
      keys: ['foo', 'foo1'],
    })

    const r1 = queue.size()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Set,
      keys: ['foo1', 'foo'],
    })

    const r2 = queue.size()

    assert.equal(r1, 1)
    assert.equal(r2, 1)
  })

  test('Enqueue multiple messages', ({ assert }) => {
    const queue = new RetryQueue()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Set,
      keys: ['foo', 'foo1'],
    })

    const r1 = queue.size()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Delete,
      keys: ['foo1', 'foo'],
    })

    const r2 = queue.size()

    assert.equal(r1, 1)
    assert.equal(r2, 2)
  })

  test('remove first inserted message if max size is reached', ({ assert }) => {
    const queue = new RetryQueue(true, 5)

    for (let i = 0; i < 5; i++) {
      queue.enqueue({
        busId: 'foo',
        type: CacheBusMessageType.Set,
        keys: [`foo-${i}`],
      })
    }

    const r1 = queue.size()

    queue.enqueue({
      busId: 'foo',
      type: CacheBusMessageType.Set,
      keys: [`foo-5`],
    })

    const r2 = queue.size()

    const queuedItems = []
    while (queue.size() > 0) queuedItems.push(queue.dequeue())

    const queuedKeys = queuedItems.map((item) => item.keys[0])

    assert.equal(r1, 5)
    assert.equal(r2, 5)
    assert.deepEqual(queuedKeys, ['foo-1', 'foo-2', 'foo-3', 'foo-4', 'foo-5'])
  })

  test('process should call handler for each message', async ({ assert }) => {
    const queue = new RetryQueue()

    for (let i = 0; i < 5; i++) {
      queue.enqueue({
        busId: 'foo',
        type: CacheBusMessageType.Set,
        keys: [`foo-${i}`],
      })
    }

    let count = 0
    await queue.process(async (message) => {
      assert.deepEqual(message.keys, [`foo-${count}`])
      count++
      return true
    })

    assert.equal(count, 5)
  })

  test('process should stop processing and re-add message to the queue if handler returns false', async ({
    assert,
  }) => {
    const queue = new RetryQueue()

    for (let i = 0; i < 5; i++) {
      queue.enqueue({
        busId: 'foo',
        type: CacheBusMessageType.Set,
        keys: [`foo-${i}`],
      })
    }

    let count = 0
    await queue.process(async () => {
      count++

      if (count === 3) return false
      return true
    })

    assert.equal(count, 3)
    assert.equal(queue.size(), 3)
  })
})
