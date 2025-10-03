---
summary: How to run and write tests for BentoCache
---

# Testing

This guide covers how to run and write tests for BentoCache.

## Environment Setup

### 1. Set Up Test Dependencies

#### Redis

```bash
# Using Docker (recommended)
docker run --name bentocache-redis -p 6379:6379 -d redis

# Or install locally
# macOS: brew install redis
# Ubuntu/Debian: sudo apt-get install redis-server
```

#### Database (for database driver tests)

```bash
# Using Docker Compose
docker-compose up -d
```

## Test Configuration

### Environment Variables

Create a `.env.testing` file in the root directory by copying the .env.testing.example as base.

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Run Tests for Specific Package

```bash
# Core package tests
cd packages/bentocache
pnpm test

# Prometheus plugin tests
cd packages/prometheus
pnpm test
```

### Run Specific Test Files

```bash
# Run a specific test file
pnpm test tests/bento_cache.spec.ts

# Run tests matching a pattern
pnpm test -t "test description"
```

### Test Coverage

```bash
cd packages/bentocache
pnpm test -- --coverage
```

## Test Structure

- `packages/bentocache/tests/` - Core package tests
  - `bento_cache.spec.ts` - Main BentoCache class tests
  - `cache/` - Cache implementation tests
  - `drivers/` - Tests for different storage drivers
  - `helpers/` - Test utilities and helpers
- `packages/prometheus/tests/` - Prometheus plugin tests

## Writing Tests

Tests use [@japa/runner](https://japa.dev/docs/). Example test structure:

```typescript
import { test } from '@japa/runner'
import { BentoCache } from '../../src/bento_cache.js'
import { memoryDriver } from '../../src/drivers/memory.js'

test.group('BentoCache', () => {
  test('should set and get value', async ({ assert }) => {
    const bento = new BentoCache({
      default: 'cache',
      stores: {
        cache: bentostore().useL1Layer(memoryDriver({})),
      },
    })

    await bento.set('key', 'value')
    assert.equal(await bento.get('key'), 'value')
  })
})
```

## Test Helpers

### Redis Helper

```typescript
import { REDIS_CREDENTIALS } from '../helpers/index.js'

const bento = new BentoCache({
  default: 'redis',
  stores: {
    redis: bentostore().useL1Layer(redisDriver(REDIS_CREDENTIALS)),
  },
})
```

### Database Helpers

Database test helpers are available in `tests/helpers/db_config.ts` for MySQL, PostgreSQL, and SQLite.

## Debugging Tests

### Debug Test Failures

To run tests in watch mode:

```bash
cd packages/bentocache
pnpm test -- --watch
```
