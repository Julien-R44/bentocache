import { test } from '@japa/runner'
import { resolveTtl } from '../src/helpers.js'

test.group('utils', () => {
  test('Resolve TTL with undefined', ({ assert }) => {
    assert.equal(30_000, resolveTtl(undefined))
  })

  test('resolve ttl with undefined and default string ttl', ({ assert }) => {
    assert.equal(86_400_000, resolveTtl(undefined, '1d'))
  })

  test('Resolve TTL with number', ({ assert }) => {
    assert.equal(10_000, resolveTtl(10_000))
  })

  test('Resolve TTL with string', ({ assert }) => {
    assert.equal(10_000, resolveTtl('10s'))
  })
})
