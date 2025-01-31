import type { Factory, GetSetFactory, RawCommonOptions } from '../main.js'

/**
 * Options accepted by the `getOrSet` method
 */
export type GetOrSetOptions = Pick<
  RawCommonOptions,
  'gracePeriod' | 'suppressL2Errors' | 'lockTimeout' | 'ttl' | 'timeouts'
>

/**
 * Options accepted by the `getOrSet` method when passing an object
 */
export type GetOrSetPojoOptions<T> = { key: string; factory: GetSetFactory<T> } & GetOrSetOptions

/**
 * Options accepted by the `getOrSetForever` method
 */
export type GetOrSetForeverOptions = Pick<
  RawCommonOptions,
  'gracePeriod' | 'suppressL2Errors' | 'lockTimeout' | 'timeouts'
>

/**
 * Options accepted by the `getOrSetForever` method when passing an object
 */
export type GetOrSetForeverPojoOptions<T> = {
  key: string
  factory: GetSetFactory<T>
} & GetOrSetForeverOptions

/**
 * Options accepted by the `set` method
 */
export type SetOptions = GetOrSetOptions

/*
 * Options accepted by the `set` method when passing an object
 */
export type SetPojoOptions = { key: string; value: any } & SetOptions

/**
 * Options accepted by the `get` method
 */
export type GetOptions = Pick<RawCommonOptions, 'gracePeriod' | 'suppressL2Errors'>

/**
 * Options accepted by the `get` method when passing an object
 */
export type GetPojoOptions<T> = { key: string; defaultValue?: Factory<T> } & GetOptions

/**
 * Options accepted by the `delete` method
 */
export type DeleteOptions = Pick<RawCommonOptions, 'suppressL2Errors'>

/**
 * Options accepted by the `delete` method when passing an object
 */
export type DeletePojoOptions = { key: string } & DeleteOptions
export type DeleteManyPojoOptions = { keys: string[] } & DeleteOptions

/**
 * Options accepted by the `has` method
 */
export type HasOptions = Pick<RawCommonOptions, 'suppressL2Errors'>

/**
 * Options accepted by the `has` method when passing an object
 */
export type HasPojoOptions = { key: string } & HasOptions

/**
 * Options accepted by the `clear` method
 */
export type ClearOptions = Pick<RawCommonOptions, 'suppressL2Errors'>
