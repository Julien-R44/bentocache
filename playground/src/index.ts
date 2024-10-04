import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import { memoryDriver } from 'bentocache/drivers/memory'
import { dynamoDbDriver } from 'bentocache/drivers/dynamodb'
import { CreateTableCommand, DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'

const dynamoConfig = {
  region: 'eu-west-3',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'foo', secretAccessKey: 'foo' },
}

const dynamoClient = new DynamoDBClient(dynamoConfig)

/**
 * Create the table for storing the cache if it does not exist
 */
async function initDynamoDb() {
  const tables = await dynamoClient.send(new ListTablesCommand())
  if (tables.TableNames?.includes('cache')) return

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

await initDynamoDb()

const bento = new BentoCache({
  default: 'multitier',
  stores: {
    myCache: bentostore().useL1Layer(memoryDriver({ maxSize: 10_000 })),

    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: 10_000 }))
      .useL2Layer(redisDriver({ connection: { host: '127.0.0.1', port: 6379 } })),

    dynamodb: bentostore().useL2Layer(
      dynamoDbDriver({ table: { name: 'cache' }, ...dynamoConfig }),
    ),
  },
})

const result = await bento.get('foo')
console.log(result)

bento.disconnectAll()
