import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  error: Error,
  request: Request,
  response: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (error.name === 'UnauthorizedError') {
    response.sendStatus(401);
  } else {
    const message = error.message || 'Error encountered';
    // console.error(error);
    response.status(500).send({
      error: message,
    });
  }
};
