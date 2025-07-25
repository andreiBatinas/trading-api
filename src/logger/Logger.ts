import * as Bunyan from 'bunyan';
import * as bunyanDebugStream from 'bunyan-debug-stream';

type MessageType<T> = T;

export class Logger {
  private handler: Bunyan;

  constructor(name: string) {
    this.handler = Bunyan.createLogger({
      name,
      level: Bunyan.TRACE,
      streams: [
        {
          stream: bunyanDebugStream.create({
            forceColor: true
          })
        }
      ],
      serializers: {
        err: Bunyan.stdSerializers.err // <--- use this
      }
    });
  }

  public info(
    message: MessageType<Error | Record<string, unknown> | string>,
    ...params: []
  ) {
    this.handler.info(message, ...params);
  }

  public error(
    message: MessageType<Error | Record<string, unknown> | string>,
    ...params: []
  ) {
    this.handler.error(message, ...params);
  }

  public warn(
    message: MessageType<Error | Record<string, unknown> | string>,
    ...params: []
  ) {
    this.handler.warn(message, ...params);
  }

  public debug(
    message: MessageType<Error | Record<string, unknown> | string>,
    ...params: []
  ) {
    this.handler.debug(message, ...params);
  }
}
