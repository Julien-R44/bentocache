/*
|--------------------------------------------------------------------------
| Collections
|--------------------------------------------------------------------------
|
| Collections represents multiple sources of documentation. For example:
| Guides can be one collection, blog can be another, and API docs can
| be another collection
|
*/

import { Collection } from '@dimerapp/content'

import { renderer } from './bootstrap.js'

const docs = new Collection()
  .db(new URL('../content/docs/db.json', import.meta.url))
  .useRenderer(renderer)
  .urlPrefix('/docs')
  .tap((entry) => {
    entry.setMarkdownOptions({ tocDepth: 3 })
  })

await docs.boot()

export const collections = [docs]
