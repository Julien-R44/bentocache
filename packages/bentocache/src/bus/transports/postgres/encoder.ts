import { CacheBusMessageType } from '../../../types/bus.js'
import type { CacheBusMessage } from '../../../types/bus.js'

/**
 * Wire format of a notification payload, as a JSON array:
 *
 *   [version, busId, typeCode, namespace, keys]
 *
 * e.g. `[1,"k3x9q2m7p1z8w4n6b5v0c2ds",1,"bentocache",["user:42"]]`
 *
 * - Type codes match the binary encoder used by the Redis bus.
 * - Characters outside ASCII are escaped as `\uXXXX`, so the payload is
 *   plain ASCII whatever the database encoding is, and its length in
 *   characters is its length in bytes.
 *
 * Compatibility rules, so that instances running different releases can
 * share a channel during a rolling deploy:
 *
 * - New fields are only ever appended. Decoders ignore elements after the
 *   ones they know, so older instances still apply the invalidation.
 * - Decoders silently ignore unknown type codes, so new kinds of messages
 *   can share the channel without older instances reporting errors.
 * - The version changes only for a change that older decoders cannot
 *   safely ignore. Older decoders drop payloads with another version, so
 *   such a change needs two steps: first release decoders that accept both
 *   versions, then switch encoders to the new one.
 */
export const WIRE_VERSION = 1

/**
 * Postgres rejects payloads of 8000 bytes or more
 * (`NOTIFY_PAYLOAD_MAX_LENGTH` with the default 8 kB block size).
 */
export const MAX_PAYLOAD_BYTES = 7999

const TYPE_TO_CODE: Record<string, number> = {
  [CacheBusMessageType.Set]: 1,
  [CacheBusMessageType.Clear]: 2,
  [CacheBusMessageType.Delete]: 3,
  [CacheBusMessageType.Expire]: 4,
}

const CODE_TO_TYPE: Record<number, CacheBusMessageType> = {
  1: CacheBusMessageType.Set,
  2: CacheBusMessageType.Clear,
  3: CacheBusMessageType.Delete,
  4: CacheBusMessageType.Expire,
}

export type EncodeResult = {
  /**
   * Payloads to send, each under the size limit. Empty only when
   * `tooLarge` is true.
   */
  payloads: string[]

  /**
   * True when a single key couldn't fit in one payload, so the message
   * was replaced by a `clear` of its namespace
   */
  replacedByClear: boolean

  /**
   * True when not even a `clear` of the namespace fits, so nothing can
   * be sent
   */
  tooLarge: boolean
}

function toAsciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /**
     * JSON.stringify already escaped control characters, so this matches
     * every UTF-16 code unit from 0x7f up. Surrogate pairs become two escapes.
     */
    /[^\x20-\x7e]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

/**
 * Encode a cache bus message into one or more notification payloads.
 *
 * Keys are split across several payloads when they don't fit in one.
 * If a single key is too large for any payload, the message is replaced
 * by a `clear` of its namespace. That clears more than needed, but it
 * never leaves another instance with a stale entry.
 */
export function encodeMessage(
  busId: string,
  message: CacheBusMessage,
  maxBytes = MAX_PAYLOAD_BYTES,
): EncodeResult {
  const code = TYPE_TO_CODE[message.type]
  if (code === undefined) throw new TypeError(`Unknown bus message type: ${message.type}`)

  const prefix = `[${WIRE_VERSION},${toAsciiJson(busId)},`
  const namespace = toAsciiJson(message.namespace ?? '')
  const head = `${prefix}${code},${namespace},[`
  const tail = ']]'
  const room = maxBytes - head.length - tail.length

  const clear = (): EncodeResult => {
    const payload = `${prefix}${TYPE_TO_CODE[CacheBusMessageType.Clear]},${namespace},[]]`
    if (payload.length > maxBytes) return { payloads: [], replacedByClear: false, tooLarge: true }
    return {
      payloads: [payload],
      replacedByClear: message.type !== CacheBusMessageType.Clear,
      tooLarge: false,
    }
  }

  if (room < 0) return clear()

  const keys = message.keys ?? []
  if (keys.length === 0) return { payloads: [head + tail], replacedByClear: false, tooLarge: false }

  const payloads: string[] = []
  let current: string[] = []
  let used = 0

  for (const key of keys) {
    const encoded = toAsciiJson(key)
    if (encoded.length > room) return clear()

    const added = (current.length > 0 ? 1 : 0) + encoded.length
    if (used + added > room) {
      payloads.push(head + current.join(',') + tail)
      current = [encoded]
      used = encoded.length
      continue
    }

    current.push(encoded)
    used += added
  }

  payloads.push(head + current.join(',') + tail)
  return { payloads, replacedByClear: false, tooLarge: false }
}

/**
 * Decode a notification payload. Returns `undefined` for anything that
 * isn't a valid payload of this wire format version.
 */
export function decodeMessage(
  payload: string,
): { busId: string; payload: CacheBusMessage } | undefined {
  let data: unknown
  try {
    data = JSON.parse(payload)
  } catch {
    return
  }

  if (!Array.isArray(data) || data[0] !== WIRE_VERSION) return

  const [, busId, code, namespace, keys] = data
  if (typeof busId !== 'string' || typeof namespace !== 'string' || typeof code !== 'number') return
  if (!Array.isArray(keys) || !keys.every(key => typeof key === 'string')) return

  const type = CODE_TO_TYPE[code]
  if (!type) return

  return { busId, payload: { type, namespace, keys } }
}
