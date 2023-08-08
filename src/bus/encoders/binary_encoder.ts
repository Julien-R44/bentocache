import type { BusEncoder, CacheBusMessage } from '../../types/bus.js'
import { CacheBusMessageType } from '../../types/bus.js'

/**
 * A Binary Encoder that encodes and decodes CacheBusMessage
 *
 * The encoding is as follows:
 * - The bus ID is encoded as a UTF8 string and directly appended to the resulting buffer.
 *   Note that the length of the bus ID should be specified in the constructor.
 *
 * - The message type is encoded as a single byte, with 0x01 for 'Set' message, and 0x02 for a 'Delete' message
 *
 * - The keys are encoded as follows:
 *   - A 4-byte big-endian integer representing the length of the key in bytes
 *   - The key itself
 *
 * - These components are concatenated together in the order busId -> type -> keys
 *
 */
export class BinaryEncoder implements BusEncoder {
  #busIdLength: number

  /**
   * We assume the bus ID is a string of length 24 by default.
   * Because this is the default length of a cuid
   */
  constructor(busIdLength = 24) {
    this.#busIdLength = busIdLength
  }

  /**
   * Encode the given message into a Buffer
   */
  encode(message: CacheBusMessage): Buffer {
    /**
     * Compute the total size needed for storing the keys
     */
    const totalKeysLength = message.keys.reduce(
      (sum, key) => sum + 4 + Buffer.byteLength(key, 'utf8'),
      0
    )
    const totalLength = this.#busIdLength + 1 + totalKeysLength

    /**
     * Allocate a single buffer for the entire message
     */
    const buffer = Buffer.alloc(totalLength)

    /**
     * 1. write the bus ID
     */
    buffer.write(message.busId, 0, this.#busIdLength, 'utf8')

    /**
     * 2. write the message type. 0x01 for 'Set' message, and 0x02 for a 'Delete' message
     */
    buffer.writeUInt8(message.type === CacheBusMessageType.Set ? 0x01 : 0x02, this.#busIdLength)

    /**
     * 3. Write the keys
     */
    let offset = this.#busIdLength + 1
    for (const key of message.keys) {
      /**
       * Compute the length of the key in bytes and write it as a 4-byte big-endian integer
       */
      const keyLength = Buffer.byteLength(key, 'utf8')
      buffer.writeUInt32BE(keyLength, offset)
      offset += 4

      /**
       * Write the key itself
       */
      buffer.write(key, offset, keyLength, 'utf8')
      offset += keyLength
    }

    return buffer
  }

  /**
   * Decode the given Buffer into a CacheBusMessage
   */
  decode(data: string | Buffer): CacheBusMessage {
    let offset = 0
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary')

    const busId = buffer.toString('utf8', offset, this.#busIdLength)
    offset += this.#busIdLength

    const typeValue = buffer.readUInt8(offset++)
    const type = typeValue === 0x01 ? CacheBusMessageType.Set : CacheBusMessageType.Delete

    const keys = []
    while (offset < buffer.length) {
      const keyLength = buffer.readUInt32BE(offset)
      offset += 4
      const key = buffer.toString('utf8', offset, offset + keyLength)
      offset += keyLength
      keys.push(key)
    }

    return { busId, keys, type }
  }
}
