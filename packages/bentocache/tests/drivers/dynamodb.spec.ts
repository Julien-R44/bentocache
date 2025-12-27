import { test } from '@japa/runner'
import { DeleteTableCommand, CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

import { DynamoDbDriver } from '../../src/drivers/dynamodb.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

const dynamoClient = new DynamoDBClient({
  region: 'eu-west-3',
  endpoint: 'http://localhost:8000',
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
  let driver: DynamoDbDriver

  group.setup(async () => {
    await createTable().catch((e) => console.error('Could not create table', e))

    driver = new DynamoDbDriver({
      prefix: 'dynamo-test',
      region: 'eu-west-3',
      endpoint: 'http://localhost:8000',
      credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
      table: { name: 'cache' },
    })

    return async () => {
      await driver.disconnect()
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

  test('getMany() should handle more than 100 items', async ({ assert }) => {
    const keys = Array.from({ length: 150 }, (_, i) => `key${i}`)

    await Promise.all(keys.map((key, i) => driver.set(key, `value${i}`)))

    const results = await driver.getMany(keys)

    assert.lengthOf(results, 150)
    assert.equal(results[0], 'value0')
    assert.equal(results[149], 'value149')
  })

  test('getMany() should retry with unprocessed keys', async ({ assert }) => {
    const mockCalls: { command: any; input: any }[] = []

    const mockSend = (command: { input: any }) => {
      const callCount = mockCalls.length + 1
      mockCalls.push({
        command,
        input: command.input,
      })

      // First call returns with unprocessed keys
      if (callCount === 1) {
        return Promise.resolve({
          Responses: {
            cache: [{ key: { S: 'dynamo-test:key1' }, value: { S: 'value1' } }],
          },
          UnprocessedKeys: {
            cache: {
              Keys: [{ key: { S: 'dynamo-test:key2' } }, { key: { S: 'dynamo-test:key3' } }],
            },
          },
        })
      }
      // Second call returns the remaining items
      return Promise.resolve({
        Responses: {
          cache: [
            { key: { S: 'dynamo-test:key2' }, value: { S: 'value2' } },
            { key: { S: 'dynamo-test:key3' }, value: { S: 'value3' } },
          ],
        },
        UnprocessedKeys: {},
      })
    }

    const mockClient = { send: mockSend } as any

    const testDriver = new DynamoDbDriver({
      prefix: 'dynamo-test',
      client: mockClient,
      table: { name: 'cache' },
      region: 'eu-west-3',
      endpoint: 'http://localhost:8000',
      credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
    })

    const results = await testDriver.getMany(['key1', 'key2', 'key3'])

    assert.deepEqual(results, ['value1', 'value2', 'value3'])

    // Verify the client was called twice (initial + retry)
    assert.equal(mockCalls.length, 2)

    // Verify the first call was with all keys
    const firstCall = mockCalls[0].input
    assert.deepEqual(firstCall.RequestItems['cache'].Keys, [
      { key: { S: 'dynamo-test:key1' } },
      { key: { S: 'dynamo-test:key2' } },
      { key: { S: 'dynamo-test:key3' } },
    ])

    // Verify the second call was with unprocessed keys only
    const secondCall = mockCalls[1].input
    assert.deepEqual(secondCall.RequestItems['cache'].Keys, [
      { key: { S: 'dynamo-test:key2' } },
      { key: { S: 'dynamo-test:key3' } },
    ])
  })
})
