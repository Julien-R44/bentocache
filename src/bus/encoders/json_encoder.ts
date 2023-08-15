/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

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
