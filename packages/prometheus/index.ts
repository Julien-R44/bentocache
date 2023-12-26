import type { BentoCachePlugin } from 'bentocache/types'

import type { PrometheusPluginOptions } from './src/types.js'
import { PrometheusPlugin } from './src/prometheus_plugin.js'

/**
 * Prometheus Plugin for Bentocache
 */
export function prometheusPlugin(options: PrometheusPluginOptions = {}): BentoCachePlugin {
  return new PrometheusPlugin(options)
}
