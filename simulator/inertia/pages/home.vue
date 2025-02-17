<script setup lang="ts">
import { Head, router, usePoll } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Card from 'primevue/card'

defineProps<{
  correctValue: number
  caches: Array<{ name: string; result: any }>
  state: { bus: boolean; l2: boolean }
}>()

usePoll(1500, { async: true })

function setCacheValue(name: string, value: any) {
  router.post('/set', { name, value })
}
</script>

<template>
  <Head title="Bentocache - Simulator" />

  <div class="container mx-auto py-12">
    <Card>
      <template #title>Summary</template>
      <template #subtitle>Cache Coherence Simulator</template>

      <template #content>
        <p class="mt-4 text-sm">
          Correct Value :
          {{ correctValue }}
        </p>

        <div class="flex gap-4 mt-4">
          <Button
            size="small"
            @click="router.post('/state', { bus: !state.bus })"
            :severity="state.bus ? 'danger' : 'success'"
          >
            {{ state.bus ? 'Disable' : 'Enable' }} Bus
          </Button>

          <Button
            size="small"
            @click="router.post('/state', { l2: !state.l2 })"
            :severity="state.l2 ? 'danger' : 'success'"
          >
            {{ state.l2 ? 'Disable' : 'Enable' }} L2
          </Button>
        </div>
      </template>
    </Card>

    <div class="grid grid-cols-3 gap-4 mt-4">
      <Card v-for="cache in caches" :key="cache.name">
        <template #title>
          <div class="flex gap-4 items-center justify-between font-light">
            <span>Node {{ cache.name }}</span>
            <Button
              size="small"
              variant="outlined"
              severity="info"
              icon="pi pi-plus"
              @click="setCacheValue(cache.name, cache.result + 1)"
            />
          </div>
        </template>
        <template #content>
          <div>
            Current Value :
            <span class="text-lg font-semibold">{{ cache.result }}</span>
          </div>

          <div class="flex gap-2 mt-2"></div>
        </template>
      </Card>
    </div>
  </div>
</template>
