import { test } from '@japa/runner'
import { DeleteTableCommand, CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

import { DynamoDB } from '../../src/drivers/dynamodb.js'
import { registerCacheDriverTestSuite } from '../../test_helpers/driver_test_suite.js'

const dynamoClient = new DynamoDBClient({
  region: 'eu-west-3',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
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
    }),
  )
}

/**
 * Delete the table that stores the cache
 */
async function deleteTable() {
  await dynamoClient.send(new DeleteTableCommand({ TableName: 'cache' }))
}

test.group('DynamoDB driver', (group) => {
  group.each.setup(async () => {
    await createTable().catch((e) => console.error('Could not create table', e))

    return async () => {
      await deleteTable().catch((e) => console.error('Could not delete table', e))
    }
  })

  registerCacheDriverTestSuite({
    group,
    driver: DynamoDB,
    supportsMilliseconds: false,
    config: {
      prefix: 'japa',
      region: 'eu-west-3',
      endpoint: process.env.DYNAMODB_ENDPOINT,
      credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
      table: { name: 'cache' },
    },
  })
})
