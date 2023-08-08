import 'dotenv/config'

import Benchmark from 'benchmark'
import { createId } from '@paralleldrive/cuid2'

import { CacheBusMessageType } from '../src/types/bus.js'
import { JsonEncoder } from '../src/bus/encoders/json_encoder.js'
import { BinaryEncoder } from '../src/bus/encoders/binary_encoder.js'
import { MsgpackEncoder } from '../src/bus/encoders/msgpack_encoder.js'

/**
 * Benchmark to compare the performance of different encoders
 *
 * What i noticed is that the BinaryEncoder is the fastest
 * when they are not many keys in the message
 *
 * As soon as the message contains more than 4 keys, the JsonEncoder
 * becomes the fastest.
 *
 * Regarding the size of the encoded messages, the BinaryEncoder
 * will be the smallest most of the time
 */

const suite = new Benchmark.Suite()

const jsonEncoder = new JsonEncoder()
const binaryEncoder = new BinaryEncoder()
const msgpackEncoder = new MsgpackEncoder()

const data = {
  busId: createId(),
  keys: ['key1'],
  type: CacheBusMessageType.Set,
}

/**
 * First let's compare the size of the encoded messages
 */
const jsonEncoded = jsonEncoder.encode(data)
const binaryEncoded = binaryEncoder.encode(data)
const msgpackEncoded = msgpackEncoder.encode(data)

const jsonSize = Buffer.from(jsonEncoded).length
const binarySize = binaryEncoded.length
const msgpackSize = msgpackEncoded.length

console.log('Json size: %d bytes', jsonSize)
console.log('Binary size: %d bytes', binarySize)
console.log('Msgpack size: %d bytes', msgpackSize)

/**
 * Then run the benchmark
 */
suite
  .add('JsonEncoder', () => jsonEncoder.decode(jsonEncoder.encode(data)))
  .add('BinaryEncoder', () => binaryEncoder.decode(binaryEncoder.encode(data)))
  .add('MsgpackEncoder', () => msgpackEncoder.decode(msgpackEncoder.encode(data)))
  .on('cycle', (event: any) => console.log(String(event.target)))
  .on('complete', function (this: Benchmark.Suite) {
    console.log('\nFastest is ' + this.filter('fastest').map('name'))
  })
  .run({ async: true })
