import { NextFunction, Request, Response } from 'express';

import { config } from '../config';

export const privateHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const botKey = request.headers[config.bots.botHeader];

  if (botKey === undefined || botKey === '') {
    return response.sendStatus(401);
  }

  if (botKey !== config.bots.botHeaderKey) {
    return response.sendStatus(401);
  }

  next();
};
