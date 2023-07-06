import { CacheDriversList } from './types/main.js'
import { InvalidArgumentsException } from '@poppinss/utils'
import driversList from './drivers_list.js'

/**
 * Define config for cache
 */
export function defineConfig<
  KnownCaches extends Record<
    string,
    {
      [K in keyof CacheDriversList]: { driver: K } & Parameters<CacheDriversList[K]>[0]
    }[keyof CacheDriversList]
  >,
>(config: { default: keyof KnownCaches; list: KnownCaches }) {
  if (!config.list) {
    throw new InvalidArgumentsException('Missing "list" property inside the cache config')
  }

  if (config.default && !config.list[config.default]) {
    throw new InvalidArgumentsException(
      `"${config.default.toString()}" is not a valid cache name. Double check the config file`,
    )
  }

  const managerCaches = Object.keys(config.list).reduce(
    (result, name: keyof KnownCaches) => {
      const cacheConfig = config.list[name]
      // @ts-ignore
      result[name] = () => driversList.create(cacheConfig.driver, cacheConfig)
      return result
    },
    {} as {
      [K in keyof KnownCaches]: CacheDriversList[KnownCaches[K]['driver']]
    },
  )

  return {
    default: config.default,
    list: managerCaches
  }
}
