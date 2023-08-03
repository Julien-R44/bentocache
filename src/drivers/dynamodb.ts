/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  BatchWriteItemCommand,
  ScanCommand,
  type AttributeValue,
  ConditionalCheckFailedException,
  BatchGetItemCommand,
} from '@aws-sdk/client-dynamodb'
import is from '@sindresorhus/is'
import chunkify from '@sindresorhus/chunkify'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, DynamoDBConfig } from '../types/main.js'

/**
 * Caching driver for DynamoDB
 */
export class DynamoDB extends BaseDriver implements CacheDriver {
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
      })
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
        ExpressionAttributeNames: {
          '#key': 'key',
        },
        ExpressionAttributeValues: {
          ':prefix': { S: this.getPrefix() },
        },
        ExclusiveStartKey: exclusiveStartKey,
      })
    )
  }

  /**
   * Delete multiple items from our table
   */
  async #batchDeleteItems(items: Record<string, AttributeValue>[]) {
    const requests = items.map((item) => ({ DeleteRequest: { Key: item } }))

    const command = new BatchWriteItemCommand({
      RequestItems: { [this.#tableName]: requests },
    })

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
    if (!item.ttl) {
      return false
    }

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
   */
  #createItemPayload(key: string, value: string, ttl?: number): Record<string, AttributeValue> {
    const type = is.numericString(value) ? 'N' : 'S'

    const item = {
      key: { S: this.getItemKey(key) },
      value: { [type]: value } as any as AttributeValue,
      ...(ttl ? { ttl: { N: this.#computeTtl(ttl) } } : {}),
    }

    return item
  }

  /**
   * Returns a new instance of the driver with the given namespace.
   */
  namespace(namespace: string) {
    return new DynamoDB({
      ...this.config,
      client: this.#client,
      prefix: this.joinPrefixes(this.getPrefix(), namespace),
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
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  async getMany(keys: string[]) {
    const command = new BatchGetItemCommand({
      RequestItems: {
        [this.#tableName]: {
          Keys: keys.map((key) => ({ key: { S: this.getItemKey(key) } })),
        },
      },
    })

    const result = await this.#client.send(command)
    return keys.map((key) => {
      const items = result.Responses?.[this.#tableName] ?? []
      const item = items.find((i) => i.key.S === this.getItemKey(key))

      if (!item || this.#isItemExpired(item)) {
        return { key, value: undefined }
      }

      return { key, value: item.value.S ?? item.value.N }
    })
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
   * Set many values in the cache
   */
  async setMany(values: { key: string; value: any }[], ttl?: number) {
    const requests = values.map(({ key, value }) => ({
      PutRequest: { Item: this.#createItemPayload(key, value, ttl) },
    }))

    const command = new BatchWriteItemCommand({
      RequestItems: { [this.#tableName]: requests },
    })

    await this.#client.send(command)

    return true
  }

  /**
   * Add the given amount to the value of a key.
   * Creates the key if it doesn't exist
   */
  async add(key: string, amount: number) {
    const command = new UpdateItemCommand({
      TableName: this.#tableName,
      Key: { key: { S: this.getItemKey(key) } },
      UpdateExpression: 'SET #value = if_not_exists(#value, :zero) + :amount',
      ExpressionAttributeNames: {
        '#value': 'value',
      },
      ExpressionAttributeValues: {
        ':amount': { N: amount.toString() },
        ':zero': { N: '0' },
      },
      ReturnValues: 'UPDATED_NEW',
    })

    const result = await this.#client.send(command)

    return Number(result.Attributes?.value.N ?? 0)
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
    await Promise.all(keys.map((key) => this.delete(key)))
    return true
  }

  /**
   * Closes the connection to the cache
   */
  disconnect() {
    this.#client.destroy()
  }
}
