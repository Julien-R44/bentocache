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

    assert.equal(r1, r2)
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
})
