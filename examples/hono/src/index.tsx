import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { setTimeout } from 'node:timers/promises'
import type { PropsWithChildren } from 'hono/jsx'

import { bento } from './bentocache'

async function fetchUser(userId: number) {
  const res = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`)
  const user = await res.json()

  return { ...user, fetchedAt: Date.now() }
}

async function CachedFragment(props: PropsWithChildren<{ ttl: string; key: string }>) {
  const html = await bento.getOrSet({
    ttl: props.ttl,
    key: props.key,
    factory: () => props.children!.toString(),
  })

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

async function Posts() {
  await setTimeout(4000)

  return (
    <ul>
      <li>Post 1</li>
      <li>Post 2</li>
      <li>Post 3</li>
      <p>Rendered at: {new Date().toLocaleString()} (will be cached for 5 seconds)</p>
    </ul>
  )
}

const app = new Hono()

app.get('/users/:id', async (c) => {
  const userId = +c.req.param('id')
  if (!userId || userId < 1 || userId > 10) {
    return c.json({ error: 'Invalid user ID' }, 400)
  }

  const user = await bento.getOrSet({
    ttl: '2s',
    key: `user:${userId}`,
    factory: async () => fetchUser(userId),
  })

  return c.html(
    <html>
      <body>
        <h1>User {userId}</h1>
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Fetched at: {new Date(user.fetchedAt).toLocaleString()}</p>

        <CachedFragment ttl="5s" key={`user:${userId}:posts`}>
          <Posts />
        </CachedFragment>
      </body>
    </html>,
  )
})

const port = 3333
console.log(`Server is running on port ${port}`)
serve({ fetch: app.fetch, port })
