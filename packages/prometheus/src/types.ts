import type { Registry } from 'prom-client'

/**
 * Options for Prometheus Plugin
 */
export interface PrometheusPluginOptions {
  registry?: Registry
  keyGroups?: Array<[RegExp, ((match: RegExpMatchArray) => string) | string]>
}
