import express from 'express';

import {
  checkPendingWithdrawals,
  createUser,
  getUserInfo,
  listNewUsers,
  listUsersToSupply,
  markToSupply,
  withdrawFunds,
} from './user.controller';

export const userRouter = express.Router();

userRouter.post('/info', getUserInfo);

userRouter.post('/create', createUser);

userRouter.get('/list-new', listNewUsers);

userRouter.get('/list-supply', listUsersToSupply);

userRouter.post('/mark-supply', markToSupply);

userRouter.post('/withdraw-funds', withdrawFunds);

// balances

userRouter.post('/withdraw/pending', checkPendingWithdrawals);
