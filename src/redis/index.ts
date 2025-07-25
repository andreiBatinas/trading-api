import ioredis from 'ioredis';

import { config } from '../config';
import { Logger } from '../logger';
import { RedisStore } from './RedisStore';

const log = new Logger('Redis');
let Redis: RedisStore;

// eslint-disable-next-line no-shadow
enum RedisError {
  ConnectionError = 'Unable to connect to redis',
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RedisConnect() {
  try {
    const r = new ioredis(config.redis.url, {});
    Redis = new RedisStore(r, log);
  } catch (e) {
    log.error(`[RedisConnect] ${RedisError.ConnectionError} ${e}`);
    throw new Error(RedisError.ConnectionError);
  }
}

// TODO: think about redis
// RedisConnect();

export { Redis, RedisConnect, RedisStore };
