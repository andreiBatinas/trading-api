import express from 'express';

import {
  ethereumDepositsNew,
  ethereumDepositsPending,
} from './deposits.controller';

export const depositRouter = express.Router();

depositRouter.post('/ethereum/deposits/new', ethereumDepositsNew);
depositRouter.post('/ethereum/deposits/pending', ethereumDepositsPending);
