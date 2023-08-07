/**
 * A TTL can be a number in milliseconds or a string formatted as a duration
 *
 * Formats accepted are :
 * - Simple number in milliseconds
 * - String formatted as a duration. Uses https://github.com/lukeed/ms under the hood
 */
export type TTL = number | string | null

/**
 * A factory is a function that returns a value or a promise of a value
 */
export type MaybePromise<T> = T | Promise<T>

export type CachedValue = any

export type KeyValueObject<T = any> = { key: string; value: T | undefined }

export type Factory<T = any> = T | (() => T) | Promise<T> | (() => Promise<T>)
