import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { setTimeout } from 'node:timers/promises'

import { bento } from './cache.js'

const app = new Hono().use(logger())

const slowFetcher = async (url: string, timeout: number = 1000) => {
  await setTimeout(timeout)
  return fetch(url).then((response) => response.json())
}

app.get('/cache-user/:id', async (c) => {
  const id = c.req.param('id')
  const user = await slowFetcher(`https://jsonplaceholder.typicode.com/users/${id}`)

  await bento.set({
    ttl: '10s',
    key: `user-${id}`,
    value: user,
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

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const port = 3042
console.log(`Server is running on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
