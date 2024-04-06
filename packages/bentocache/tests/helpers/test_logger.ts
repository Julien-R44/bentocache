import type { Logger } from '../../src/types/main.js'

/**
 * A logger that stores all logs in an array.
 */
export class TestLogger implements Logger {
  logs: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    msg: any
    obj: any
  }[] = []

  child(): Logger {
    return this
  }

  trace(obj: unknown, msg?: unknown): void {
    this.logs.push({ level: 'trace', msg, obj })
  }

  debug(obj: unknown, msg?: unknown): void {
    this.logs.push({ level: 'debug', msg, obj })
  }

  info(obj: unknown, msg?: unknown): void {
    this.logs.push({ level: 'info', msg, obj })
  }

  warn(obj: unknown, msg?: unknown): void {
    this.logs.push({ level: 'warn', msg, obj })
  }

  error(obj: unknown, msg?: unknown): void {
    this.logs.push({ level: 'error', msg, obj })
  }

  fatal(obj: unknown, msg?: unknown): void {
    this.logs.push({ level: 'fatal', msg, obj })
  }
}
