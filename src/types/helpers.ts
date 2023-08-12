/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * A Duration can be a number in milliseconds or a string formatted as a duration
 *
 * Formats accepted are :
 * - Simple number in milliseconds
 * - String formatted as a duration. Uses https://github.com/lukeed/ms under the hood
 */
export type Duration = number | string | null

/**
 * A factory is a function that returns a value or a promise of a value
 */
export type MaybePromise<T> = T | Promise<T>

/**
 * A Factory is basically just a function that returns a value
 */
export type Factory<T = any> = T | (() => T) | Promise<T> | (() => Promise<T>)

/**
 * Logger interface
 */
export type { Logger } from 'typescript-log'
