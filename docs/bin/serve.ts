import 'reflect-metadata'

import { Ignitor } from '@adonisjs/core'
import { readFile } from 'node:fs/promises'
import type { ApplicationService } from '@adonisjs/core/types'
import { defineConfig as defineHttpConfig } from '@adonisjs/core/http'

import { viteConfig } from '../config/vite.js'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

/**
 * Defining routes for development server
 */
async function defineRoutes(app: ApplicationService) {
  const { default: server } = await import('@adonisjs/core/services/server')
  const { collections } = await import('#src/collections')
  const { default: router } = await import('@adonisjs/core/services/router')

  server.use([() => import('@adonisjs/static/static_middleware')])
  const redirects = await readFile(app.publicPath('_redirects'), 'utf-8')
  const redirectsCollection = redirects.split('\n').reduce(
    (result, line) => {
      const [from, to] = line.split(' ')
      result[from] = to
      return result
    },
    {} as Record<string, string>,
  )

  router.get('*', async ({ request, response }) => {
    if (redirectsCollection[request.url()]) {
      return response.redirect(redirectsCollection[request.url()])
    }

    for (const collection of collections) {
      await collection.refresh()
      const entry = collection.findByPermalink(request.url())
      if (entry) return entry.render({ collection, entry }).catch((error) => console.log(error))
    }

    return response.notFound('Page not found')
  })
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.initiating(() => {
      app.useConfig({
        appUrl: process.env.APP_URL || '',
        app: {
          appKey: 'zKXHe-Ahdb7aPK1ylAJlRgTefktEaACi',
          http: defineHttpConfig({}),
        },
        static: {
          enabled: true,
          etag: true,
          lastModified: true,
          dotFiles: 'ignore',
        },
        logger: {
          default: 'app',
          loggers: { app: { enabled: true } },
        },
        vite: viteConfig,
      })
    })

    app.starting(defineRoutes)
  })
  .httpServer()
  .start()
  .catch(console.error)
