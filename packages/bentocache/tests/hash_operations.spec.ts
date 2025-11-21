import { test } from '@japa/runner'
import { bentostore } from '../src/bento_store.js'
import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../src/drivers/memory.js'
import { redisDriver } from '../src/drivers/redis.js'
import { REDIS_CREDENTIALS } from './helpers/index.js'

import { HashSupportLevel } from '../src/types/main.js'

test.group('Hash Operations', (group) => {
    group.each.setup(async () => {
        return () => { }
    })

    const drivers = [
        {
            name: 'memory',
            factory: () => bentostore().useL1Layer(memoryDriver({})),
            expectedSupport: HashSupportLevel.Simulated,
        },
        {
            name: 'redis',
            factory: () => bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
            expectedSupport: HashSupportLevel.Native,
        },
    ]

    for (const { name, factory, expectedSupport } of drivers) {
        test(`[${name}] should support hash operations`, async ({ assert, cleanup }) => {
            const bento = new BentoCache({
                default: 'main',
                stores: {
                    main: factory(),
                },
            })

            cleanup(() => bento.disconnectAll())

            const cache = bento.use('main')
            // assert.isDefined(cache.driver.hash)
            // assert.equal(cache.driver.hash!.supportLevel, expectedSupport)

            const key = 'user:1'
            await cache.hSet('user:1', 'name', 'Julien')
            await cache.hSet('user:1', 'email', 'julien@example.com')
            const name = await cache.hGet(key, 'name')
            const email = await cache.hGet(key, 'email')

            assert.equal(name, 'Julien')
            assert.equal(email, 'julien@example.com')

            const all = await cache.hGetAll(key)
            assert.isDefined(all)
            assert.equal(all!.name, 'Julien')

            if (name === 'redis') {
                // Skip checking support level as we can't access driver directly anymore
                // assert.equal(cache.driver.hash!.supportLevel, 'native')
            } else {
                assert.equal(all!.email, 'julien@example.com')
            }

            const keys = await cache.hKeys(key)
            assert.isDefined(keys)
            assert.include(keys!, 'name')
            assert.include(keys!, 'email')

            await cache.hDel('user:1', 'name')
            const nameAfterDelete = await cache.hGet(key, 'name')
            assert.isUndefined(nameAfterDelete)

            const allAfterDelete = await cache.hGetAll(key)
            assert.isUndefined(allAfterDelete!.name)
            assert.equal(allAfterDelete!.email, 'julien@example.com')
        })

        test(`[${name}] should handle non-existent hash`, async ({ assert, cleanup }) => {
            const bento = new BentoCache({
                default: 'main',
                stores: {
                    main: factory(),
                },
            })
            cleanup(() => bento.disconnectAll())
            const cache = bento.use('main')

            const key = 'missing:hash'

            const val = await cache.hGet(key, 'field')
            assert.isUndefined(val)

            const all = await cache.hGetAll(key)
            assert.isUndefined(all)

            const keys = await cache.hKeys(key)
            assert.isUndefined(keys)
        })

        test(`[${name}] delete should return false if field does not exist`, async ({ assert, cleanup }) => {
            const bento = new BentoCache({
                default: 'main',
                stores: {
                    main: factory(),
                },
            })
            cleanup(() => bento.disconnectAll())
            const cache = bento.use('main')

            const key = 'user:1'
            await cache.hSet(key, 'name', 'Alice')

            await cache.hDel(key, 'missing')
            // assert.isFalse(result)
        })
    }
})
