/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import 'virtual:uno.css'
import 'primeicons/primeicons.css'

import { createApp, h } from 'vue'
import PrimeVue from 'primevue/config'
import Nora from '@primevue/themes/aura'
import type { DefineComponent } from 'vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

createInertiaApp({
  progress: { color: '#5468FF' },
  title: (title) => `${title}`,
  resolve: (name) => {
    return resolvePageComponent(
      `../pages/${name}.vue`,
      import.meta.glob<DefineComponent>('../pages/**/*.vue'),
    )
  },

  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(PrimeVue, { theme: { preset: Nora } })
      .mount(el)
  },
})
