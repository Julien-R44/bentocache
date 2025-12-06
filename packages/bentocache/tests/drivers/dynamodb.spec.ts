import { test } from '@japa/runner'
import { DeleteTableCommand, CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

import { DynamoDbDriver } from '../../src/drivers/dynamodb.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

const dynamoClient = new DynamoDBClient({
  region: 'eu-west-3',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
})

/**
 * Create the table for storing the cache
 */
async function createTable() {
  await dynamoClient
    .send(
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
    .catch(() => {})
}

/**
 * Delete the table that stores the cache
 */
async function deleteTable() {
  await dynamoClient.send(new DeleteTableCommand({ TableName: 'cache' }))
}

test.group('DynamoDB driver', (group) => {
  group.setup(async () => {
    await createTable().catch((e) => console.error('Could not create table', e))

    return async () => {
      await deleteTable().catch((e) => console.error('Could not delete table', e))
    }
  })

  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      return new DynamoDbDriver({
        prefix: 'japa',
        region: 'eu-west-3',
        endpoint: 'http://localhost:8000',
        credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
        table: { name: 'cache' },
        ...options,
      })
    },
  })
})
