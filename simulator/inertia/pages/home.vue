<script setup lang="ts">
import { Head, router, usePoll } from '@inertiajs/vue3'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ScrollPanel from 'primevue/scrollpanel'
import ToggleSwitch from 'primevue/toggleswitch'

defineProps<{
  correctValue: number
  caches: Array<{ name: string; result: any; busId: string }>
  state: { bus: boolean; l2: boolean }
  sentMessages: Array<any>
  receivedMessages: Array<any>
}>()

usePoll(1500, { async: true })

function setCacheValue(name: string, value: any) {
  router.post('/set', { name, value }, { preserveScroll: true })
}

function deleteCacheValue(name: string) {
  router.post('/delete', { name }, { preserveScroll: true })
}

const severities = ['secondary', 'success', 'info', 'warn', 'danger', 'contrast']
function getCacheColor(name: string) {
  return severities[(name.at(-1) as any) % severities.length]
}
</script>

<template>
  <Head title="Bentocache - Simulator" />

  <div class="container mx-auto py-12">
    <Card>
      <template #title>Summary</template>
      <template #subtitle>Cache Coherence Simulator</template>

      <template #content>
        <div class="grid grid-cols-[200px_200px] items-center gap-4 mt-4">
          <span>Correct Value :</span>
          <span class="font-semibold text-2xl">
            {{ correctValue }}
          </span>
          <div class="flex items-center gap-2">
            <span>
              <i
                class="pi"
                :class="{
                  'text-green-500 pi-check-circle': state.bus,
                  'text-red-500 pi-times-circle': !state.bus,
                }"
              />
            </span>
            <span>Bus is {{ state.bus ? 'enabled' : 'disabled' }}</span>
          </div>
          <ToggleSwitch
            v-model="state.bus"
            @change="router.post('/state', { bus: state.bus }, { preserveScroll: true })"
          />

          <div class="flex items-center gap-2">
            <span>
              <i
                class="pi"
                :class="{
                  'text-green-500 pi-check-circle': state.l2,
                  'text-red-500 pi-times-circle': !state.l2,
                }"
              />
            </span>
            <span>L2 is {{ state.l2 ? 'enabled' : 'disabled' }}</span>
          </div>
          <ToggleSwitch
            v-model="state.l2"
            @change="router.post('/state', { l2: state.l2 }, { preserveScroll: true })"
          />
        </div>
      </template>
    </Card>

    <div class="grid grid-cols-3 gap-4 mt-4">
      <Card v-for="cache in caches" :key="cache.name">
        <template #title>
          <div class="flex gap-4 items-center justify-between font-light">
            <span>Node {{ cache.name }}</span>
            <div class="flex gap-2">
              <Button
                size="small"
                variant="outlined"
                severity="info"
                icon="pi pi-plus"
                @click="setCacheValue(cache.name, cache.result + 1)"
              />
              <Button
                size="small"
                variant="outlined"
                severity="danger"
                icon="pi pi-trash"
                @click="deleteCacheValue(cache.name)"
              />
            </div>
          </div>
        </template>
        <template #content>
          <div class="flex justify-center py-3 text-5xl w-full text-center font-semibold">
            {{ cache.result }}
          </div>
          <div class="flex gap-2 mt-2"></div>
        </template>
      </Card>
    </div>

    <Card class="mt-4">
      <template #title>Bus logs</template>

      <template #content>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <p>Sent messages</p>
            <ScrollPanel style="width: 100%; height: 300px">
              <div class="p-2 grid gap-2">
                <div v-for="(log, idx) in sentMessages" :key="idx" class="flex items-center gap-2">
                  <Badge size="small" :severity="getCacheColor(log.cacheName)">
                    {{ log.cacheName }}
                  </Badge>

                  <Badge size="small" :severity="log.message.type === 'set' ? 'info' : 'danger'">
                    {{ log.message.type }}
                  </Badge>

                  <span>{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                  <span class="text-xs text-[var(--p-slate-300)]">{{ log.message }}</span>
                </div>
              </div>
            </ScrollPanel>
          </div>

          <div>
            <p>Received messages</p>
            <ScrollPanel style="width: 100%; height: 300px">
              <div class="p-2 grid gap-2">
                <div
                  v-for="(log, idx) in receivedMessages"
                  :key="idx"
                  class="flex items-center gap-2"
                >
                  <Badge size="small" :severity="getCacheColor(log.cacheName)">
                    {{ log.cacheName }}
                  </Badge>

                  <Badge size="small" :severity="log.message.type === 'set' ? 'info' : 'danger'">
                    {{ log.message.type }}
                  </Badge>

                  <span>{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                  <span class="text-xs text-[var(--p-slate-300)]">{{ log.message }}</span>
                </div>
              </div>
            </ScrollPanel>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
