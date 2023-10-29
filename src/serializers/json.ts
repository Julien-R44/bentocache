import type { CacheSerializer } from '../types/main.js'

/**
 * Simple class to serialize and deserialize values using JSON
 */
export class JsonSerializer implements CacheSerializer {
  serialize(value: unknown) {
    return JSON.stringify(value)
  }

  deserialize(value: string) {
    return JSON.parse(value)
  }
}
