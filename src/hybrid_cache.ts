// export class Cache {
//   /**
//    * Underlying driver
//    */
//   #driver: CacheDriver

//   /**
//    * Emitter to use when emitting cache:* events
//    */
//   #emitter?: Emitter

//   /**
//    * Serializer to use when storing and retrieving values
//    */
//   #serializer: CacheSerializer = new JsonSerializer()

//   /**
//    * Default TTL in milliseconds
//    */
//   #defaultTtl: number

//   /**
//    * Name of the cache store
//    */
//   #name: string

//   /**
//    * A map of locks to use for getOrSet cache stampede protection
//    */
//   #locks = new Map<string, Mutex>()

//   #gracefulRetain: GracefulRetainOptions

//   constructor(
//     name: string,
//     driver: CacheDriver,
//     options: {
//       emitter?: Emitter
//       ttl?: TTL
//       serializer?: CacheSerializer
//       gracefulRetain: GracefulRetainOptions
//     }
//   ) {
//     this.#name = name
//     this.#driver = driver
//     this.#emitter = options.emitter
//     this.#defaultTtl = this.#resolveTtl(options.ttl) ?? 1000 * 60 * 60
//     this.#serializer = options.serializer ?? this.#serializer
//     this.#gracefulRetain = options.gracefulRetain
//   }
// }
