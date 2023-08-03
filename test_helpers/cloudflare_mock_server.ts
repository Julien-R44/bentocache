/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { rest } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Cloudflare looks super flaky. Sometime tests pass, sometimes they don't.
 * We sometime have to wait a bit after a .set() to be able to .get()
 * the value. Also, it's super slow. Each test takes around 4/5 second
 * when hitting the real API.
 *
 * So for running tests, this is not ideal. But for real
 * world usage, i guess it can be fine.
 *
 * Meanwhile, we setup an MSW mock and we use it to test the driver.
 */

const baseURL =
  'https://api.cloudflare.com/client/v4/accounts/:accountId/storage/kv/namespaces/:namespaceId'

const store: Record<string, { value: string; expiration?: number }> = {}

/**
 * Check if a record is expired
 */
function isRecordExpired(record: (typeof store)[string]) {
  if (!record.expiration) {
    return false
  }

  const now = Date.now()
  const expirationDate = record.expiration

  return now > expirationDate
}

/**
 * Parse the received TTL and return the expiration date
 */
function parseReceivedTtl(ttl: string | null) {
  if (!ttl) {
    return undefined
  }

  const ttlInMs = +ttl * 1000

  const realTtl = Date.now() + ttlInMs
  const minTtl = 60 * 1000 - 30

  return realTtl - minTtl
}

export const cloudflareMockServer = setupServer(
  /**
   * Get key
   */
  rest.get(`${baseURL}/values/:key`, (req, res, ctx) => {
    const key = req.params.key as string

    if (!(key in store)) {
      return res(ctx.status(404), ctx.json(null))
    }

    if (isRecordExpired(store[key])) {
      delete store[key]
      return res(ctx.status(404), ctx.json(null))
    }

    return res(
      ctx.status(200),
      ctx.set('content-type', 'application/octet-stream'),
      ctx.body(store[key].value)
    )
  }),

  /**
   * Put key
   */
  rest.put(`${baseURL}/values/:key`, async (req, res, ctx) => {
    const key = req.params.key as string
    const ttl = req.url.searchParams.get('expiration_ttl')

    store[key] = {
      ...(store[key] || {}),
      value: await req.text(),
      expiration: parseReceivedTtl(ttl),
    }

    return res(ctx.json({ success: true }))
  }),

  /**
   * Put keys in bulk
   */
  rest.put(`${baseURL}/bulk`, async (req, res, ctx) => {
    const data = await req.json()

    data.forEach((item: any) => {
      store[item.key] = {
        ...(store[item.key] || {}),
        value: item.value,
        expiration: parseReceivedTtl(item.expiration_ttl),
      }
    })
    return res(ctx.status(200), ctx.json({ success: true }))
  }),

  /**
   * Delete key
   */
  rest.delete(`${baseURL}/values/:key`, (req, res, ctx) => {
    const key = req.params.key as string
    if (store[key]) {
      delete store[key]
      return res(ctx.status(204), ctx.json({ success: true }))
    }

    return res(ctx.status(200), ctx.json({ success: false }))
  }),

  /**
   * Delete keys in bulk
   */
  rest.delete(`${baseURL}/bulk`, async (req, res, ctx) => {
    const data = await req.json()

    for (const item of data) {
      if (store[item]) {
        delete store[item]
      }
    }

    return res(ctx.status(204), ctx.json({ success: true }))
  }),

  /**
   * List keys
   */
  rest.get(`${baseURL}/keys`, (req, res, ctx) => {
    const prefix = req.url.searchParams.get('prefix') || ''
    let keys = Object.keys(store)

    if (req.url.searchParams.has('prefix')) {
      keys = keys.filter((key) => key.startsWith(prefix))
    }

    const result = keys.map((key) => ({ name: key }))

    const data = {
      result,
      success: true,
      errors: [],
      messages: [],
      result_info: {
        count: keys.length,
        cursor: '',
      },
    }

    return res(ctx.status(200), ctx.json(data))
  })
) as any
