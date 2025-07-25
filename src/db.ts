import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { Sequelize } from 'sequelize';

import { config } from './config';

const sslCert = undefined;

const poolConfig: PoolConfig = {
  application_name: 'trading',
  connectionString: config.db.trading.connectionString,
  ssl: {
    rejectUnauthorized: !!sslCert,
    ca: sslCert,
  },
};

if (!config.db.ssl) {
  poolConfig.ssl = undefined;
}

export const sequelize = new Sequelize(config.db.trading.connectionString, {
  dialect: 'postgres',
  dialectOptions: poolConfig,
  logging: false,
});

export class DB {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(poolConfig);
  }

  public async query<R extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<R>> {
    if (params !== undefined) {
      return this.pool.query(text, params);
    }
    return this.pool.query(text);
  }
}
