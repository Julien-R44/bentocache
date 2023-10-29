import type { CacheBusMessage } from '../../types/bus.js'

/**
 * A simple JSON encoder
 */
export class JsonEncoder {
  encode(message: CacheBusMessage): string {
    return JSON.stringify(message)
  }

  decode(data: string): CacheBusMessage {
    return JSON.parse(data)
  }
}
