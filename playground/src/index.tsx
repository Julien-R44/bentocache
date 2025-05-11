import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { register } from 'prom-client'
import { serve } from '@hono/node-server'
import { setTimeout } from 'node:timers/promises'

import { bento } from './cache.js'

const app = new Hono().use(logger())

const slowFetcher = async (url: string, timeout: number = 1000) => {
  await setTimeout(timeout)
  return fetch(url).then(async (response) => ({
    ...(await response.json()),
    fetchedAt: new Date().toISOString(),
  }))
}

app.get('/invalidate-users', async (c) => {
  await bento.deleteByTag({ tags: ['user'] })

  return c.text('Invalidated users')
})

app.get('/cache-user/:id', async (c) => {
  const id = c.req.param('id')
  const user = await slowFetcher(`https://jsonplaceholder.typicode.com/users/${id}`)

  await bento.set({
    ttl: '50s',
    key: `user-${id}`,
    value: user,
    tags: ['user'],
  })

  return c.html(
    <div>
      <h1>User {id}</h1>
      <p>Cached for 10 seconds</p>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>,
  )
})

app.get('/cached-user/:id', async (c) => {
  const id = c.req.param('id')
  const user = await bento.get({ key: `user-${id}`, defaultValue: 'NOT CACHED' })

  return c.html(
    <div>
      <h1>User {id}</h1>
      <p>From cache</p>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>,
  )
})

app.get('/get-set-post/:id', async (c) => {
  const id = c.req.param('id')
  const user = await bento.getOrSet({
    key: `posts-${id}`,
    factory: async () => {
      const result = await slowFetcher(`https://jsonplaceholder.typicode.com/posts/${id}`)
      setTimeout(5000).then(() => console.log('5s passed. expired'))

      return result
    },
    ttl: '5s',
    grace: '10m',
  })

  return c.html(
    <div>
      <h1>User {id}</h1>
      <p>From cache or set</p>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>,
  )
})

app.get('/', (c) => c.text('Hello Hono!'))
app.get('/metrics', async (c) => {
  return c.text(await register.metrics(), 200, { 'Content-Type': register.contentType })
})

const port = 3042
serve({ fetch: app.fetch, port })
console.log(`Server is running on http://localhost:${port}`)
