import { z } from 'zod'
import { test } from '@japa/runner'
import { is } from '@julr/utils/is'

import { errors } from '../../src/errors.js'
import { CacheFactory } from '../../factories/cache_factory.js'

test.group('Validation', () => {
  test('works with standard schema', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await assert.rejects(async () => {
      await cache.set({
        key: 'foo',
        value: { foo: 3 },
        validate: z.object({ foo: z.string(), bar: z.number() }),
      })
      // @ts-ignore
    }, errors.E_VALIDATION_ERROR)
  })

  test('works with fn', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await assert.rejects(async () => {
      await cache.set({
        key: 'foo',
        value: { foo: 3 },
        validate: (value) => {
          if (!is.plainObject(value)) {
            throw new TypeError('Value must be an object')
          }

          if (typeof value.foo !== 'string') {
            throw new TypeError('Value must be a string')
          }
        },
      })
      // @ts-ignore
    }, errors.E_VALIDATION_ERROR)
  })

  test('doesnt throw when validation passes', async () => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({
      key: 'foo',
      value: { foo: '3' },
      validate: z.object({ foo: z.string() }),
    })

    await cache.set({
      key: 'foo',
      value: { foo: '3' },
      validate: (value) => {
        if (!is.plainObject(value)) throw new TypeError('Value must be an object')
        if (typeof value.foo !== 'string') throw new TypeError('Value must be a string')
      },
    })
  })

  test('cache object transformed by schema', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({
      key: 'foo',
      value: { foo: 'wesh' },
      validate: z.object({ foo: z.string().toUpperCase() }),
    })

    const r1 = await cache.get({ key: 'foo' })
    assert.deepEqual(r1, { foo: 'WESH' })
  })

  test('works with getOrSet', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await assert.rejects(async () => {
      await cache.getOrSet({
        key: 'foo',
        factory: () => ({ foo: 3 }),
        validate: z.object({ foo: z.string() }),
      })
      // @ts-ignore
    }, errors.E_VALIDATION_ERROR)

    const r1 = await cache.get({ key: 'foo' })
    assert.isUndefined(r1)

    await cache.getOrSet({
      key: 'foo',
      factory: () => ({ foo: 'foo' }),
      validate: z.object({ foo: z.string() }),
    })
  })

  test('validate when fetching from getOrSet', async () => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: { foo: 3 } })

    await cache.getOrSet({
      key: 'foo',
      factory: () => ({ foo: 'foo' }),
      validate: z.object({ foo: z.string() }),
    })
  })
})
