import 'unpoly'

import Alpine from 'alpinejs'
import mediumZoom from 'medium-zoom'
import { tabs } from 'edge-uikit/tabs'
import Persist from '@alpinejs/persist'
import docsearch from '@docsearch/js/docsearch'
import { initZoomComponent, initBaseComponents } from '@dimerapp/docs-theme/scripts'

import.meta.glob([
  '../content/**/*.png',
  '../content/**/*.jpeg',
  '../content/**/*.jpg',
  '../content/**/*.webp',
])

Alpine.plugin(tabs)
Alpine.plugin(Persist)
Alpine.plugin(initBaseComponents)
Alpine.data('search', function (options) {
  let instance

  return {
    init() {
      instance = docsearch({
        container: this.$el,
        appId: options.appId,
        apiKey: options.apiKey,
        indices: [options.indexName],
      })
    },
    destroy() {
      instance?.destroy()
    },
  }
})
Alpine.plugin(initZoomComponent(mediumZoom))
Alpine.start()
