import bodyParser from 'body-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';

import { config } from './config';
import { depositRouter } from './deposits/deposits.router';
import { Logger } from './logger';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import { privateHandler } from './middleware/private.middleware';
import { RedisConnect } from './redis';
import { tradingRouter } from './trading/trading.route';
import { userRouter } from './user/user.route';

// eslint-disable-next-line @typescript-eslint/require-await
async function main() {
  const log = new Logger('main');

  const app = express();

  RedisConnect();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(bodyParser.json());

  app.use('/healthz', (req: Request, res: Response) => {
    res.sendStatus(200);
  });

  app.use('/user', privateHandler, userRouter);
  app.use('/deposits', privateHandler, depositRouter);

  app.use('/trading', privateHandler, tradingRouter);

  app.use(errorHandler);
  app.use(notFoundHandler);

  const httpServer = createServer(app);
  // socketIo(httpServer);

  httpServer.listen(config.express.port, () => {
    log.info(`listening on port ${config.express.port}.`);
  });
}

void main();

// natsService.start().catch((err: string) => {
//   logger.info(`Nats Service start failure: + ${err}`);
//   throw new Error('Nats Service start failure:' + err);
// });
