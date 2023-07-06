import { CacheService } from "./main.js"

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    cache: CacheService
  }
}
