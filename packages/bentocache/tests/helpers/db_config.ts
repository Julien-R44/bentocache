export enum DatabaseType {
  MYSQL = 'mysql',
  SQLITE = 'sqlite',
  POSTGRES = 'postgres',
}

export function getDbConfig(dialect: DatabaseType) {
  const config = {
    mysql: {
      client: 'mysql2',
      connection: {
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'password',
        database: process.env.MYSQL_DATABASE || 'bentocache_test',
        port: Number.parseInt(process.env.MYSQL_PORT || '3306'),
      },
    },
    postgres: {
      client: 'pg',
      connection: {
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'postgres',
      },
    },
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: process.env.SQLITE_FILENAME || ':memory:',
      },
      useNullAsDefault: true,
    },
  }

  return config[dialect]
}

export type DbConfig = ReturnType<typeof getDbConfig>
