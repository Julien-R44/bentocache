import { chunkify } from '@julr/utils/array/chunkify'
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  BatchWriteItemCommand,
  ScanCommand,
  type AttributeValue,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, CreateDriverResult, DynamoDBConfig } from '../types/main.js'

/**
 * Create a new DynamoDB driver
 */
export function dynamoDbDriver(options: DynamoDBConfig): CreateDriverResult<DynamoDbDriver> {
  return {
    options,
    factory: (config: DynamoDBConfig) => new DynamoDbDriver(config),
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
   * Name of the table to use
   * Defaults to `cache`
   */
  #tableName: string

  constructor(config: DynamoDBConfig & { client?: DynamoDBClient }) {
    super(config)

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
        ExpressionAttributeValues: { ':prefix': { S: this.prefix } },
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
   * Check if a key exists in the cache
   */
  async has(key: string) {
    const item = await this.get(key)
    return item !== undefined
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
