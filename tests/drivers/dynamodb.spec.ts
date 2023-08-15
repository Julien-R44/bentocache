/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { DeleteTableCommand, CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

import { DynamoDB } from '../../src/drivers/dynamodb.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

const dynamoClient = new DynamoDBClient({
  region: 'eu-west-3',
  endpoint: process.env.DYNAMODB_ENDPOINT,
})

/**
 * Create the table for storing the cache
 */
async function createTable() {
  await dynamoClient.send(
    new CreateTableCommand({
      TableName: 'cache',
      KeySchema: [{ AttributeName: 'key', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'key', AttributeType: 'S' }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 4,
        WriteCapacityUnits: 4,
      },
    })
  )
}

/**
 * Delete the table that stores the cache
 */
async function deleteTable() {
  await dynamoClient.send(
    new DeleteTableCommand({
      TableName: 'cache',
    })
  )
}

registerApiTestSuite({
  test,
  driver: DynamoDB,
  supportsMilliseconds: false,
  config: {
    prefix: 'japa',
    region: 'eu-west-3',
    endpoint: process.env.DYNAMODB_ENDPOINT,
    table: {
      name: 'cache',
    },
  },

  /**
   * We create and delete the table between
   * each tests
   */
  eachSetup: async () => {
    await createTable().catch((e) => {
      console.error('Could not create table', e)
    })
  },
  eachTeardown: async () => {
    await deleteTable().catch((e) => {
      console.error('Could not delete table', e)
    })
  },
})
