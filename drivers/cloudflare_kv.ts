import { CloudflareKv } from '../src/drivers/cloudflare_kv.js'
import type { CloudflareKvConfig, CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new Cloudflare KV driver
 */
export function cloudflareKvDriver(options: CloudflareKvConfig): CreateDriverResult {
  return { local: { options, factory: (config: CloudflareKvConfig) => new CloudflareKv(config) } }
}
