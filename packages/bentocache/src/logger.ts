import type { Logger as InternalLogger, LogObject } from '@julr/utils/logger'

import type { CacheEntryOptions } from './cache/cache_entry/cache_entry_options.js'

export class Logger {
  internalLogger: InternalLogger

  constructor(internalLogger: InternalLogger) {
    this.internalLogger = internalLogger
  }

  child(obj: LogObject) {
    return new Logger(this.internalLogger.child(obj))
  }

  trace(msg: any, obj?: any) {
    this.internalLogger.trace(msg, obj)
  }

  debug(msg: any, obj?: any) {
    this.internalLogger.debug(msg, obj)
  }

  warn(msg: any, obj?: any) {
    this.internalLogger.warn(msg, obj)
  }

  error(msg: any, obj?: any) {
    this.internalLogger.error(msg, obj)
  }

  fatal(msg: any, obj?: any) {
    this.internalLogger.fatal(msg, obj)
  }

  info(msg: any, obj?: any) {
    this.internalLogger.info(msg, obj)
  }

  logMethod(options: {
    cacheName: string
    options: CacheEntryOptions
    key?: string | string[]
    method: string
  }) {
    this.internalLogger.debug(
      { cacheName: options.cacheName, opId: options.options.id, key: options.key },
      `'${options.method}' method called`,
    )
  }

  logL1Hit(options: {
    cacheName: string
    key: string
    options: CacheEntryOptions
    graced?: boolean
  }) {
    this.internalLogger.debug(
      {
        cacheName: options.cacheName,
        opId: options.options.id,
        key: options.key,
        graced: options.graced,
      },
      'memory hit',
    )
  }

  logL2Hit(options: {
    cacheName: string
    key: string
    options: CacheEntryOptions
    graced?: boolean
  }) {
    this.internalLogger.debug(
      {
        cacheName: options.cacheName,
        opId: options.options.id,
        key: options.key,
        graced: options.graced,
      },
      'remote hit',
    )
  }
}
