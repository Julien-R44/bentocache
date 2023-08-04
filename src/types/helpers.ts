/**
 * A TTL can be a number in milliseconds or a string formatted as a duration
 *
 * Formats accepted are :
 * - Simple number in milliseconds
 * - String formatted as a duration. Uses https://github.com/lukeed/ms under the hood
 */
export type TTL = number | string

/**
 * A type that represents either a value or a promise that resolves to that value.
 */
export type MaybePromise<T> = T | Promise<T>

export type CachedValue = any
export type KeyValueObject = { key: string; value: string | undefined }
