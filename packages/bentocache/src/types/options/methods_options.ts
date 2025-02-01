import type { Factory, GetSetFactory, RawCommonOptions } from '../main.js'

/**
 * Options accepted by the `getOrSet` method
 */
export type SetCommonOptions = Pick<
  RawCommonOptions,
  'grace' | 'graceBackoff' | 'suppressL2Errors' | 'lockTimeout' | 'ttl' | 'timeouts'
>

/**
 * Options accepted by the `getOrSet` method when passing an object
 */
export type GetOrSetOptions<T> = { key: string; factory: GetSetFactory<T> } & SetCommonOptions

/**
 * Options accepted by the `getOrSetForever` method when passing an object
 */
export type GetOrSetForeverOptions<T> = {
  key: string
  factory: GetSetFactory<T>
} & Pick<
  RawCommonOptions,
  'grace' | 'graceBackoff' | 'suppressL2Errors' | 'lockTimeout' | 'timeouts'
>

/**
 * Options accepted by the `set` method
 */
export type SetOptions = { key: string; value: any } & SetCommonOptions

/**
 * Options accepted by the `get` method when passing an object
 */
export type GetOptions<T> = { key: string; defaultValue?: Factory<T> } & Pick<
  RawCommonOptions,
  'grace' | 'graceBackoff' | 'suppressL2Errors'
>

/**
 * Options accepted by the `delete` method when passing an object
 */
export type DeleteOptions = { key: string } & Pick<RawCommonOptions, 'suppressL2Errors'>
export type DeleteManyOptions = { keys: string[] } & Pick<RawCommonOptions, 'suppressL2Errors'>

/**
 * Options accepted by the `has` method when passing an object
 */
export type HasOptions = { key: string } & Pick<RawCommonOptions, 'suppressL2Errors'>

/**
 * Options accepted by the `clear` method
 */
export type ClearOptions = Pick<RawCommonOptions, 'suppressL2Errors'>
