export const cacheEvents = {
  cleared(store: string) {
    return {
      name: 'cache:cleared' as const,
      data: { store },
    }
  },
  deleted(key: string, store: string) {
    return {
      name: 'cache:deleted' as const,
      data: { key, store },
    }
  },
  hit(key: string, value: any, store: string, graced: boolean = false) {
    return {
      name: 'cache:hit' as const,
      data: { key, value, store, graced },
    }
  },
  miss(key: string, store: string) {
    return {
      name: 'cache:miss' as const,
      data: { key, store },
    }
  },
  written(key: string, value: any, store: string) {
    return {
      name: 'cache:written' as const,
      data: { key, value, store },
    }
  },
  expire(key: string, store: string) {
    return {
      name: 'cache:expire' as const,
      data: { key, store },
    }
  },
}
