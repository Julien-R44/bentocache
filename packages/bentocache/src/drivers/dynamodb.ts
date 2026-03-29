import { chunkify } from '@julr/utils/array/chunkify'
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  BatchGetItemCommand,
  BatchWriteItemCommand,
  ScanCommand,
  type AttributeValue,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb'

import type { Logger } from '../logger.js'
import { BaseDriver } from './base_driver.js'
import type {
  CacheDriver,
  CreateDriverResult,
  DynamoDBConfig,
  DriverCommonInternalOptions,
} from '../types/main.js'

/**
 * Create a new DynamoDB driver
 */
export function dynamoDbDriver(options: DynamoDBConfig): CreateDriverResult<DynamoDbDriver> {
  return {
    options,
    factory: (config: DynamoDBConfig & DriverCommonInternalOptions) => new DynamoDbDriver(config),
  }
}

/**
 * Caching driver for DynamoDB
 */
export class DynamoDbDriver extends BaseDriver implements CacheDriver {
  type = 'l2' as const

  /**
   * DynamoDB client
   */
  #client: DynamoDBClient

  /**
   * Configuration
   */
  declare config: DynamoDBConfig

  /**
   * Logger
   */
  protected logger?: Logger

  /**
   * Name of the table to use
   * Defaults to `cache`
   */
  #tableName: string

  constructor(config: DynamoDBConfig & DriverCommonInternalOptions & { client?: DynamoDBClient }) {
    super(config)

    this.logger = config.logger

    this.#tableName = this.config.table.name ?? 'cache'

    if (config.client) {
      this.#client = config.client
      return
    }

    this.#client = new DynamoDBClient({
      region: config.region,
      credentials: config.credentials,
      endpoint: config.endpoint,
    })
  }

  /**
   * Try to delete an item from the cache.
   * If the item doesn't exist, a `ConditionalCheckFailedException` is thrown.
   */
  async #deleteItem(key: string) {
    await this.#client.send(
      new DeleteItemCommand({
        TableName: this.#tableName,
        Key: { key: { S: this.getItemKey(key) } },
        ConditionExpression: 'attribute_exists(#key)',
        ExpressionAttributeNames: { '#key': 'key' },
      }),
    )
  }

  /**
   * Scan the table for items with our prefix
   * Returns a paginated list of items
   */
  async #getStoredItems(exclusiveStartKey?: Record<string, AttributeValue>) {
    return await this.#client.send(
      new ScanCommand({
        TableName: this.#tableName,
        ProjectionExpression: '#key',
        FilterExpression: 'begins_with(#key, :prefix)',
        ExpressionAttributeNames: { '#key': 'key' },
        ExpressionAttributeValues: { ':prefix': { S: `${this.prefix}:` } },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
  }

  /**
   * Delete multiple items from our table
   */
  async #batchDeleteItems(items: Record<string, AttributeValue>[]) {
    const requests = items.map((item) => ({ DeleteRequest: { Key: item } }))
    const command = new BatchWriteItemCommand({ RequestItems: { [this.#tableName]: requests } })
    await this.#client.send(command)
  }

  /**
   * Check if the given item TTL is expired.
   *
   * We have to do this manually for local execution against
   * the dynamodb-local docker image since it doesn't support
   * TTLs.
   */
  #isItemExpired(item: Record<string, AttributeValue>) {
    if (!item.ttl) return false

    const now = Math.floor(Date.now() / 1000)
    return Number(item.ttl.N) < now
  }

  /**
   * Convert a TTL duration in miliseconds to
   * a UNIX timestamp in seconds since DynamoDB
   * accepts this format.
   */
  #computeTtl(ttl: number) {
    return Math.floor((Date.now() + ttl) / 1000).toString()
  }

  /**
   * Generate the payload for a WriteRequest
   *
   * We append the TTL attribute only if a TTL is defined.
   * If no TTL is defined, the item will never expire.
   */
  #createItemPayload(key: string, value: string, ttl?: number): Record<string, AttributeValue> {
    return {
      key: { S: this.getItemKey(key) },
      value: { S: value },
      ...(ttl ? { ttl: { N: this.#computeTtl(ttl) } } : {}),
    }
  }

  /**
   * Returns a new instance of the driver with the given namespace.
   */
  namespace(namespace: string) {
    return new DynamoDbDriver({
      ...this.config,
      client: this.#client,
      prefix: this.createNamespacePrefix(namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    const command = new GetItemCommand({
      Key: { key: { S: this.getItemKey(key) } },
      TableName: this.#tableName,
    })

    const data = await this.#client.send(command)

    if (!data.Item || this.#isItemExpired(data.Item)) {
      return undefined
    }

    return data.Item.value.S ?? data.Item.value.N
  }

  /**
   * Get multiple values in order. Expired items return undefined.
   *
   * DynamoDB has a limit of 100 items per BatchGetItem request, so we chunk
   * the keys and make multiple parallel requests. Implements retry logic for
   * UnprocessedKeys with exponential backoff.
   *
   * Returns the values in the same order as the keys were requested.
   */
  async getMany(keys: string[]) {
    if (keys.length === 0) return []

    const prefixedKeys = keys.map((key) => this.getItemKey(key))
    /**
     * DynamoDB will throw a ValidationException if we request the same key twice
     * in the same batch, so we need to deduplicate them.
     */
    const uniqueKeys = [...new Set(prefixedKeys)]
    const chunks = Array.from(chunkify(uniqueKeys, 100))
    const keyToValueMap: Record<string, string | undefined> = {}

    try {
      /**
       * We'll fetch all chunks in parallel to speed up the process.
       */
      const chunkPromises = chunks.map((chunk: string[]) => this.#getBatchWithRetry(chunk))
      const allItemsArrays = await Promise.all(chunkPromises)
      const allItems = allItemsArrays.flat()

      const deletePromises: Promise<any>[] = []

      for (const item of allItems) {
        if (!item.key?.S) {
          if (this.logger) {
            this.logger.warn('DynamoDB item missing key attribute', { item })
          }
          continue
        }

        if (!this.#isItemExpired(item)) {
          /**
           * DynamoDB stores values differently depending on their type, so we
           * need to extract them accordingly.
           */
          let value: string | undefined
          if (item.value?.S) {
            value = item.value.S
          } else if (item.value?.N) {
            value = item.value.N
          }

          if (value !== undefined) {
            keyToValueMap[item.key.S] = value
          }
        } else {
          /**
           * If we encounter an expired item, we'll delete it in the background
           * and log any errors that occur.
           *
           * We need to strip the prefix because the delete method will append it again.
           */
          const logicalKey = this.prefix ? item.key.S.slice(this.prefix.length + 1) : item.key.S

          deletePromises.push(
            this.delete(logicalKey).catch((err) => {
              if (this.logger) {
                this.logger.warn('Failed to delete expired key', {
                  key: item.key.S,
                  error: err.message,
                })
              }
            }),
          )
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to fetch items from DynamoDB', {
          keyCount: keys.length,
          error,
        })
      }
      throw error
    }

    return prefixedKeys.map((key) => keyToValueMap[key])
  }

  /**
   * Fetch a batch of keys with retry logic for UnprocessedKeys
   */
  async #getBatchWithRetry(keys: string[], maxRetries = 3): Promise<Record<string, any>[]> {
    let unprocessedKeys = keys
    const allItems: Record<string, any>[] = []

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (unprocessedKeys.length === 0) break

      const requestItems = {
        [this.#tableName]: {
          Keys: unprocessedKeys.map((key) => ({ key: { S: key } })),
        },
      }

      const command = new BatchGetItemCommand({ RequestItems: requestItems })
      const data = await this.#client.send(command)

      const items = data.Responses?.[this.#tableName] ?? []
      allItems.push(...items)

      const unprocessed = data.UnprocessedKeys?.[this.#tableName]?.Keys
      if (!unprocessed || unprocessed.length === 0) {
        break
      }

      unprocessedKeys = unprocessed.map((k) => k.key.S).filter((k): k is string => !!k)

      if (unprocessedKeys.length > 0 && attempt < maxRetries) {
        /**
         * If we have unprocessed keys, we wait for a bit before retrying.
         * We use exponential backoff to avoid hammering DynamoDB.
         */
        const backoffMs = Math.pow(2, attempt) * 100
        await new Promise((resolve) => setTimeout(resolve, backoffMs))

        if (this.logger) {
          this.logger.debug('Retrying unprocessed keys', {
            attempt: attempt + 1,
            unprocessedCount: unprocessedKeys.length,
            backoffMs,
          })
        }
      }
    }

    if (unprocessedKeys.length > 0 && this.logger) {
      this.logger.warn('Failed to process all keys after retries', {
        unprocessedCount: unprocessedKeys.length,
        maxRetries,
      })
    }

    return allItems
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string) {
    const value = await this.get(key)
    if (value === undefined) {
      return undefined
    }

    await this.delete(key)
    return value
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: string, ttl?: number) {
    const command = new PutItemCommand({
      TableName: this.#tableName,
      Item: this.#createItemPayload(key, value, ttl),
    })

    await this.#client.send(command)

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    let exclusiveStartKey: Record<string, AttributeValue> | undefined

    do {
      /**
       * Scan the table for items that have the store prefix. This
       * call is paginated, so we need to repeat until there are
       * no more items to delete.
       */
      const result = await this.#getStoredItems(exclusiveStartKey)

      /**
       * Make chunks of 25 items since AWS only allows deleting 25 items
       * at a time
       */
      const chunkedItems = chunkify(result.Items ?? [], 25)

      /**
       * Delete items, one chunk at a time to avoid exceeding the
       * provisioned throughput for the table.
       *
       * A better approach would be to use configured provisioned throughput
       * and use the `ReturnConsumedCapacity` parameter to check if the
       * throughput is exceeded. If it is, wait for a bit and try again.
       */
      for (const chunk of chunkedItems) {
        await this.#batchDeleteItems(chunk)
      }

      /**
       * Repeat until there are no more items to delete
       */
      exclusiveStartKey = result.LastEvaluatedKey
    } while (exclusiveStartKey)
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    try {
      await this.#deleteItem(key)
      return true
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false
      }

      throw error
    }
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    if (keys.length === 0) return true
    await Promise.all(keys.map((key) => this.delete(key)))
    return true
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    this.#client.destroy()
  }
}
