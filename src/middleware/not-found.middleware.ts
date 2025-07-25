import {
  NextFunction,
  Request,
  Response,
} from 'express';

export const notFoundHandler = (
  request: Request,
  response: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  response.sendStatus(404);
};
