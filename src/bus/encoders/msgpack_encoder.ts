import msgpack from 'msgpack5'
import type { BusEncoder, CacheBusMessage } from '../../types/bus.js'

/**
 * A Msgpack encoder
 */
export class MsgpackEncoder implements BusEncoder {
  #msgpack = msgpack()

  constructor() {}

  encode(message: CacheBusMessage): string {
    return this.#msgpack.encode(message).toString('binary')
  }

  decode(data: string): CacheBusMessage {
    return this.#msgpack.decode(Buffer.from(data, 'binary'))
  }
}
