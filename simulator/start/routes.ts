import vine from '@vinejs/vine'
import { is } from '@julr/utils/is'
import { BentoCache, bentostore } from 'bentocache'
import router from '@adonisjs/core/services/router'
import { memoryDriver } from 'bentocache/drivers/memory'
import { redisDriver, redisBusDriver } from 'bentocache/drivers/redis'
import type { CreateBusDriverResult, CreateDriverResult, L2CacheDriver } from 'bentocache/types'

import { ChaosBus } from './chaos/chaos_bus.js'
import { ChaosCache } from './chaos/chaos_cache.js'

const kNodesCount = 15
const state = { bus: true, l2: true }
const nodes: Map<string, { bento: BentoCache<any>; bus: ChaosBus; l2: ChaosCache<L2CacheDriver> }> =
  new Map()

const trueCache = new BentoCache({
  default: 'default',
  prefix: '',
  stores: {
    default: bentostore().useL2Layer(
      redisDriver({ connection: { host: '127.0.0.1', port: 6379 } }),
    ),
  },
})

function createChaosBus(options: any): CreateBusDriverResult {
  const bus = new ChaosBus(redisBusDriver(options).factory(options))
  return { options, factory: () => bus }
}

function createChaosL2Cache(options: any): CreateDriverResult<any> {
  const l2 = new ChaosCache(redisDriver(options).factory(options))
  return { options, factory: () => l2 }
}

/**
 * Create our x number of nodes
 */
for (let i = 0; i < kNodesCount; i++) {
  const bus = createChaosBus({ connection: { host: '127.0.0.1', port: 6379 } })
  const l2 = createChaosL2Cache({ connection: { host: '127.0.01', port: 6379 } })

  const bentoCache = new BentoCache({
    default: 'default',
    stores: {
      default: bentostore()
        .useL1Layer(memoryDriver({ serialize: true }))
        .useL2Layer(l2)
        .useBus(bus),
    },
  })

  nodes.set(`cache-${i}`, {
    bento: bentoCache,
    bus: bus.factory({}) as ChaosBus,
    l2: l2.factory({}) as ChaosCache<L2CacheDriver>,
  })
}

router.get('/', async ({ inertia }) => {
  const results = await Promise.all(
    nodes.entries().map(async ([key, cache]) => {
      return {
        name: key,
        result: await cache.bento.get({ key: 'value', defaultValue: 0 }),
        busId: cache.bus.id,
      }
    }),
  )

  return inertia.render('home', {
    correctValue: await trueCache.get({ key: 'value', defaultValue: 0 }),
    caches: results,
    state,
    sentMessages: [...nodes.entries()]
      .map(([key, cache]) =>
        cache.bus.sentMessages.map((message) => ({ ...message, cacheName: key })),
      )
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40),
    receivedMessages: [...nodes.entries()]
      .map(([key, cache]) =>
        cache.bus.receivedMessages.map((message) => ({ ...message, cacheName: key })),
      )
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40),
  })
})

router.post('/set', async ({ request, response }) => {
  const cacheName = request.input('name')

  if (!nodes.has(cacheName)) {
    return response.status(400).send('Invalid cache name')
  }

  const cache = nodes.get(cacheName)
  const currentValue = await cache!.bento.get({ key: 'value', defaultValue: 0 })
  await cache?.bento.set({ key: 'value', value: currentValue + 1 })

  return response.redirect().toPath('/')
})

router.post('/delete', async ({ request, response }) => {
  const cacheName = request.input('name')

  if (!nodes.has(cacheName)) {
    return response.status(400).send('Invalid cache name')
  }

  const cache = nodes.get(cacheName)
  await cache?.bento.delete({ key: 'value' })

  return response.redirect().toPath('/')
})

const stateSchema = vine.compile(
  vine.object({
    bus: vine.boolean().optional(),
    l2: vine.boolean().optional(),
  }),
)

router.post('/state', async ({ request, response }) => {
  const payload = await request.validateUsing(stateSchema)

  if (!is.undefined(payload.bus)) {
    state.bus = payload.bus
  }

  if (!is.undefined(payload.l2)) {
    state.l2 = payload.l2
  }

  nodes.forEach((cache) => {
    if (!is.undefined(payload.bus) && !payload.bus) {
      cache.bus.alwaysThrow()
    } else {
      cache.bus.neverThrow()
    }

    if (!is.undefined(payload.l2) && !payload.l2) {
      cache.l2.alwaysThrow()
    } else {
      cache.l2.neverThrow()
    }
  })

  return response.redirect().toPath('/')
})
