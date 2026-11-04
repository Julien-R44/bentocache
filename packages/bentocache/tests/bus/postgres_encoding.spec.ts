import { test } from '@japa/runner'

import { CacheBusMessageType } from '../../src/types/bus.js'
import type { CacheBusMessage } from '../../src/types/bus.js'
import {
  MAX_PAYLOAD_BYTES,
  decodeMessage,
  encodeMessage,
} from '../../src/bus/transports/postgres/encoder.js'
import {
  MAX_CHANNEL_BYTES,
  quoteChannel,
  toPostgresChannel,
} from '../../src/bus/transports/postgres/channel.js'

const BUS_ID = 'k3x9q2m7p1z8w4n6b5v0c2ds'

test.group('Postgres bus | channel names', () => {
  test('keeps names of up to 63 bytes as is', ({ assert }) => {
    assert.equal(toPostgresChannel('bentocache.notifications'), 'bentocache.notifications')

    const exact = 'a'.repeat(MAX_CHANNEL_BYTES)
    assert.equal(toPostgresChannel(exact), exact)
  })

  test('shortens longer names to 63 bytes with a hash suffix', ({ assert }) => {
    const name = `bentocache.notifications:${'store'.repeat(20)}`
    const channel = toPostgresChannel(name)

    assert.isAtMost(Buffer.byteLength(channel), MAX_CHANNEL_BYTES)
    assert.match(channel, /^bentocache\.notifications:store.*~[0-9a-f]{16}$/)
    assert.equal(toPostgresChannel(name), channel)
  })

  test('keeps long names that share a prefix distinct', ({ assert }) => {
    const prefix = 'x'.repeat(80)
    assert.notEqual(toPostgresChannel(`${prefix}a`), toPostgresChannel(`${prefix}b`))
  })

  test('turns names with characters outside printable ASCII into ASCII', ({ assert }) => {
    const channel = toPostgresChannel('bentocache.notifications:магазин')

    assert.match(channel, /^bentocache\.notifications:_{7}~[0-9a-f]{16}$/)
    assert.equal(toPostgresChannel('bentocache.notifications:магазин'), channel)
  })

  test('replaces each character, not each UTF-16 unit or byte, by one underscore', ({ assert }) => {
    assert.match(toPostgresChannel('a😀b'), /^a_b~[0-9a-f]{16}$/)
    assert.match(toPostgresChannel('a\u0000b\nc'), /^a_b_c~[0-9a-f]{16}$/)
  })

  test('keeps non-ASCII names that look the same in ASCII distinct', ({ assert }) => {
    const names = [
      'store:日本',
      'store:中国',
      'store:__',
      `store:e${String.fromCodePoint(0x301)}`, // é as e + combining accent
      `store:${String.fromCodePoint(0xe9)}`, // é as one character
    ]
    const channels = names.map(toPostgresChannel)

    assert.lengthOf(new Set(channels), names.length)
    assert.equal(channels[2], 'store:__')
  })

  test('cuts long non-ASCII names to 63 bytes of printable ASCII', ({ assert }) => {
    for (const name of ['日本'.repeat(40), '😀'.repeat(80), `${'x'.repeat(60)}日本`]) {
      const channel = toPostgresChannel(name)

      assert.isAtMost(Buffer.byteLength(channel), MAX_CHANNEL_BYTES)
      assert.match(channel, /^[\x20-\x7e]+~[0-9a-f]{16}$/)
    }
  })

  test('hashes an empty name, which Postgres rejects', ({ assert }) => {
    assert.match(toPostgresChannel(''), /^~[0-9a-f]{16}$/)
  })

  test('quotes channel names for LISTEN', ({ assert }) => {
    assert.equal(quoteChannel('bentocache.notifications'), '"bentocache.notifications"')
    assert.equal(quoteChannel('a"b'), '"a""b"')
  })
})

test.group('Postgres bus | encoding', () => {
  test('round trips every message type', ({ assert }) => {
    for (const type of Object.values(CacheBusMessageType)) {
      const message: CacheBusMessage = {
        type,
        namespace: 'users',
        keys: type === 'clear' ? [] : ['a', 'b'],
      }
      const { payloads } = encodeMessage(BUS_ID, message)

      assert.lengthOf(payloads, 1)
      assert.deepEqual(decodeMessage(payloads[0]), { busId: BUS_ID, payload: message })
    }
  })

  test('uses the compact array format with a version number', ({ assert }) => {
    const { payloads } = encodeMessage(BUS_ID, {
      type: CacheBusMessageType.Set,
      namespace: 'bentocache',
      keys: ['user:42'],
    })

    assert.deepEqual(payloads, [`[1,"${BUS_ID}",1,"bentocache",["user:42"]]`])
  })

  test('encodes a missing namespace as an empty string', ({ assert }) => {
    const { payloads } = encodeMessage(BUS_ID, { type: CacheBusMessageType.Delete, keys: ['a'] })

    assert.deepEqual(decodeMessage(payloads[0])?.payload, {
      type: CacheBusMessageType.Delete,
      namespace: '',
      keys: ['a'],
    })
  })

  test('escapes non-ASCII characters so payloads are plain ASCII', ({ assert }) => {
    const message: CacheBusMessage = {
      type: CacheBusMessageType.Set,
      namespace: 'naïve',
      keys: ['café:ü:日本', 'emoji:😀', 'quote:"\\'],
    }
    const { payloads } = encodeMessage(BUS_ID, message)

    assert.match(payloads[0], /^[\x20-\x7e]+$/)
    assert.deepEqual(decodeMessage(payloads[0])?.payload, message)
  })

  test('splits keys across payloads that fit the size limit', ({ assert }) => {
    const keys = Array.from({ length: 2000 }, (_, i) => `product:${i}:`.padEnd(40, 'x'))
    const result = encodeMessage(BUS_ID, {
      type: CacheBusMessageType.Delete,
      namespace: 'bentocache',
      keys,
    })

    assert.isFalse(result.replacedByClear)
    assert.isAbove(result.payloads.length, 1)

    const decodedKeys: string[] = []
    for (const payload of result.payloads) {
      assert.isBelow(Buffer.byteLength(payload), 8000)
      const decoded = decodeMessage(payload)!
      assert.equal(decoded.payload.type, CacheBusMessageType.Delete)
      assert.equal(decoded.payload.namespace, 'bentocache')
      decodedKeys.push(...decoded.payload.keys)
    }

    assert.deepEqual(decodedKeys, keys)
  })

  test('fills payloads up to the size limit', ({ assert }) => {
    for (let length = 1; length < 300; length += 7) {
      const keys = Array.from({ length: 500 }, (_, i) => `${i}:`.padEnd(length, 'k'))
      const { payloads } = encodeMessage(BUS_ID, {
        type: CacheBusMessageType.Delete,
        namespace: 'ns',
        keys,
      })

      for (const [index, payload] of payloads.entries()) {
        assert.isAtMost(payload.length, MAX_PAYLOAD_BYTES)
        if (index === payloads.length - 1) continue

        const nextKey = decodeMessage(payloads[index + 1])!.payload.keys[0]
        assert.isAbove(payload.length + JSON.stringify(nextKey).length + 1, MAX_PAYLOAD_BYTES)
      }
    }
  })

  test('replaces a message with a key that cannot fit by a namespace clear', ({ assert }) => {
    const result = encodeMessage(BUS_ID, {
      type: CacheBusMessageType.Set,
      namespace: 'users',
      keys: ['small', 'k'.repeat(8000)],
    })

    assert.isTrue(result.replacedByClear)
    assert.lengthOf(result.payloads, 1)
    assert.deepEqual(decodeMessage(result.payloads[0])?.payload, {
      type: CacheBusMessageType.Clear,
      namespace: 'users',
      keys: [],
    })
  })

  test('counts escaped characters when checking the size limit', ({ assert }) => {
    const result = encodeMessage(BUS_ID, {
      type: CacheBusMessageType.Set,
      namespace: 'users',
      keys: ['日'.repeat(1500)],
    })

    assert.isTrue(result.replacedByClear)
  })

  test('reports a namespace that is too long to send', ({ assert }) => {
    const result = encodeMessage(BUS_ID, {
      type: CacheBusMessageType.Set,
      namespace: 'n'.repeat(8000),
      keys: ['a'],
    })

    assert.isTrue(result.tooLarge)
    assert.deepEqual(result.payloads, [])
  })

  test('ignores fields appended by newer releases', ({ assert }) => {
    const expected = {
      busId: BUS_ID,
      payload: { type: CacheBusMessageType.Delete, namespace: 'users', keys: ['a', 'b'] },
    }

    for (const extra of ['"sender",42', '{"seq":1},[1,2]', 'null']) {
      const payload = `[1,"${BUS_ID}",3,"users",["a","b"],${extra}]`
      assert.deepEqual(decodeMessage(payload), expected, payload)
    }
  })

  test('rejects unknown message types', ({ assert }) => {
    assert.throws(
      () => encodeMessage(BUS_ID, { type: 'nope' as any, keys: [] }),
      'Unknown bus message type: nope',
    )
  })

  test('ignores payloads it does not understand', ({ assert }) => {
    const invalid = [
      '',
      'not json',
      '{"busId":"a","payload":{}}',
      '[]',
      `[2,"${BUS_ID}",1,"",["a"]]`,
      `[1,"${BUS_ID}",9,"",["a"]]`,
      `[1,"${BUS_ID}","1","",["a"]]`,
      `[1,42,1,"",["a"]]`,
      `[1,"${BUS_ID}",1,null,["a"]]`,
      `[1,"${BUS_ID}",1,"","a"]`,
      `[1,"${BUS_ID}",1,"",[1]]`,
    ]

    for (const payload of invalid) assert.isUndefined(decodeMessage(payload), payload)
  })
})
