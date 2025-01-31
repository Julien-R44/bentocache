/*
|--------------------------------------------------------------------------
| Development server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
|
*/

import 'reflect-metadata'

import { Ignitor } from '@adonisjs/core'

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
 * Exports collection to HTML files
 */
async function exportHTML() {
  const { collections } = await import('#src/collections')
  const { default: app } = await import('@adonisjs/core/services/app')

  for (const collection of collections) {
    for (const entry of collection.all()) {
      await entry.writeToDisk(app.makePath('dist'), { collection, entry })
    }
  }
}

const app = new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.initiating(() => {
      app.useConfig({
        appUrl: process.env.APP_URL || '',
        app: {
          appKey: 'zKXHe-Ahdb7aPK1ylAJlRgTefktEaACi',
          http: {},
        },
        logger: {
          default: 'app',
          loggers: {
            app: {
              enabled: true,
            },
          },
        },
        vite: viteConfig,
      })
    })
  })
  .createApp('console')

await app.init()
await app.boot()
await app.start(exportHTML)
