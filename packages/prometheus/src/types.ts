import type { Registry } from 'prom-client'

/**
 * Options for Prometheus Plugin
 */
export interface PrometheusPluginOptions {
  /**
   * Prefix for Prometheus metrics
   *
   * @default `bentocache`
   */
  prefix?: string

  /**
   * Registry to use for Prometheus metrics
   *
   * Defaults to the global prom-client registry
   */
  registry?: Registry

  /**
   * Key groups
   *
   * See https://bentocache.dev/docs/plugin-prometheus#keygroups
   */
  keyGroups?: Array<[RegExp, ((match: RegExpMatchArray) => string) | string]>
}
