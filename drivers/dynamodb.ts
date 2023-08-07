import { DynamoDB } from '../src/drivers/dynamodb.js'
import type { CreateDriverResult, DynamoDBConfig } from '../src/types/main.js'

/**
 * Create a new MySQL driver
 */
export function dynamoDbDriver(options: DynamoDBConfig): CreateDriverResult {
  return { local: { options, factory: (config: DynamoDBConfig) => new DynamoDB(config) } }
}
