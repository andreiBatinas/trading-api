// eslint-disable-next-line max-classes-per-file
import {
  connect,
  DebugEvents,
  Events,
  JSONCodec,
  NatsConnection,
} from 'nats';

import { config } from './config';
import { logger } from './logger';

type ResponseFunc = (responseOrder: any) => Promise<void>;

export class PublishError extends Error {
  constructor() {
    super();
    this.name = 'PublishError';
  }
}

export class nats {
  private nc!: NatsConnection;
  private jc: any;

  constructor() {
    this.jc = JSONCodec();
  }

  private initializeNatsConnection = async () => {
    try {
      this.nc = await connect({ servers: config.nats.connectionUrl });
      logger.info(`backend nats connected ${this.nc.getServer()}`);
    } catch (err: any) {
      logger.error(`Error connecting to nats: ${err.message}`);
      throw new Error();
    }

    this.nc
      .closed()
      .then((err: any) => {
        if (err) {
          logger.error(`NATS connection closed with an error: ${err.message}`);
        } else {
          logger.warn('NATS connection closed');
        }
      })
      .catch((err) => {
        logger.error('error listening on nats closed evt', err);
      });

    (async () => {
      for await (const s of this.nc.status()) {
        switch (s.type) {
          case Events.Disconnect:
            logger.warn(`client disconnected - ${s.data}`);
            break;
          case Events.LDM:
            logger.warn('client has been requested to reconnect');
            break;
          case Events.Update:
            logger.warn(`client received a cluster update - ${s.data}`);
            break;
          case Events.Reconnect:
            logger.warn(`client reconnected - ${s.data}`);
            break;
          case Events.Error:
            logger.warn('client got a permissions error');
            break;
          case DebugEvents.Reconnecting:
            logger.warn('client is attempting to reconnect');
            break;
          case DebugEvents.StaleConnection:
            logger.warn('client has a stale connection');
            break;
          case DebugEvents.PingTimer:
            break;
          default:
            logger.warn(`got an unknown status ${s.type}`);
        }
      }
    })().catch((err) => {
      logger.error('error listening on nats client events', err);
    });
  };

  public publish = (channel: string, msg: any) => {
    const codec = JSONCodec();
    try {
      if (this.nc !== null) {
        this.nc.publish(channel, codec.encode(msg));
      }
    } catch (error: any) {
      logger.error(`NATS connection closed with an error: ${error.message}`);
      // connection is down for whatever reason, restart it and subscribe back
      this.start();
      throw new PublishError();
    }
  };

  public start = async () => {
    await this.initializeNatsConnection();
  };
}

const natsService = new nats();

export { natsService };
