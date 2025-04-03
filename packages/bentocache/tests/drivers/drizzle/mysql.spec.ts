import mysql from 'mysql2/promise'
import { test } from '@japa/runner'
import { drizzle } from 'drizzle-orm/mysql2'

import { createDrizzleStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Drizzle | MySQL driver', (group) => {
  // 只有在连接成功时才注册测试套件
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: true,
    createDriver: (options) => {
      const db = drizzle({
        client: mysql.createPool({
          host: 'localhost',
          port: 3306,
          database: 'test',
          user: 'root',
          password: 'root',
        }),
      })

      return createDrizzleStore({
        connection: db,
        dialect: 'mysql',
        prefix: 'japa',
        ...options,
      })
    },
  })
})
