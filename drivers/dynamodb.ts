import { DynamoDB } from '../src/drivers/dynamodb.js'
import type { CreateDriverResult, DynamoDBConfig } from '../src/types/main.js'

/**
 * Create a new DynamoDB driver
 */
export function dynamoDbDriver(options: DynamoDBConfig): CreateDriverResult {
  return {
    l1: { options, factory: (config: DynamoDBConfig) => new DynamoDB(config) },
  }
}
