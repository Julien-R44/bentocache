import { test } from '@japa/runner'
import { MemoryTransport } from '@rlanz/bus/drivers/memory'

import { resolveTtl } from '../src/helpers.js'

test.group('Utils', () => {
  test('resolve TTL with undefined', ({ assert }) => {
    assert.equal(30_000, resolveTtl(undefined))
  })

  test('resolve ttl with undefined and default string ttl', ({ assert }) => {
    assert.equal(86_400_000, resolveTtl(undefined, '1d'))
  })

  test('resolve TTL with number', ({ assert }) => {
    assert.equal(10_000, resolveTtl(10_000))
  })

  test('resolve TTL with string', ({ assert }) => {
    assert.equal(10_000, resolveTtl('10s'))
  })

  test('MemoryBus should not receive message published by itself', ({ assert }) => {
    const bus1 = new MemoryTransport()

    bus1.subscribe('channel', () => assert.fail())
    bus1.publish('channel', { data: 'test' } as any)

    bus1.disconnect()
  })

  test('Two memory bus instances should be able to communicate', ({ assert }) => {
    assert.plan(1)

    const bus1 = new MemoryTransport().setId('bus1')
    const bus2 = new MemoryTransport().setId('bus2')

    bus1.subscribe('channel', (message: any) => assert.equal(message.data, 'test'))
    bus2.publish('channel', { data: 'test' } as any)

    bus1.disconnect()
    bus2.disconnect()
  })
})
