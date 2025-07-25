import BigNumber from 'bignumber.js';
import { ethers, isAddress } from 'ethers';
import { NextFunction, Request, Response } from 'express';

import { v3Aggregator } from '../abis/V3Aggregator';
import { config } from '../config';
import { sequelize } from '../db';
import { Logger } from '../logger';
import { User } from '../models';
import { WithdrawTransactions } from '../models/withdraw-transactions.model';
import { ethereumProvider } from '../services/ethereum-provider';
import { getFeeObject } from '../services/gas-station';
import { decreaseBalanceHelper } from './user.balance';

// const db = new DB();

const log = new Logger('UserInfo');

export const getUserInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.chatId) {
    log.error(`error no chat id`);
    return res.sendStatus(400);
  }

  const chatId = req.body.chatId.toString();
  try {
    const user = await User.findOne({
      where: {
        chatId,
      },
      attributes: ['evmAddress', 'balance'],
    });

    if (!user) {
      return res.status(200).send({
        status: 'fail',
        error: 'user not found',
      });
    }

    const balance = new BigNumber(user.balance)
      .dividedBy(1e6)
      .toFixed(2, BigNumber.ROUND_DOWN);

    const address = user.evmAddress;
    const amountUsdc = balance;

    return res.status(200).send({
      status: 'success',
      user: {
        address,
        usdc: amountUsdc,
      },
    });
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.chatId) {
    log.error(`error no chat id`);
    return res.sendStatus(400);
  }
  try {
    const chatId = req.body.chatId.toString();

    const newWallet = ethers.Wallet.createRandom();

    const address = newWallet.address;
    const privateKey = newWallet.privateKey;

    await User.create({
      evmAddress: address,
      evmPrivateAddress: privateKey,
      chatId,
    });

    return res.status(201).send({
      status: 'success',
      address,
    });
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const listNewUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await User.findAll({
      where: {
        toSupply: false,
      },
      attributes: ['evmAddress', 'evmPrivateAddress'],
    });

    return res.status(200).send({
      status: 'success',
      users,
    });
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const listUsersToSupply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await User.findAll({
      where: {
        toSupply: true,
      },
      attributes: ['evmAddress', 'evmPrivateAddress'],
    });

    return res.status(200).send({
      status: 'success',
      users,
    });
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const markToSupply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.address) {
    log.error(`error no chat id`);
    return res.sendStatus(200);
  }

  const address = req.body.address;

  try {
    await User.update(
      {
        toSupply: true,
      },
      {
        where: {
          evmAddress: address,
        },
      }
    );

    return res.status(200).send();
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const withdrawFunds = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.chatId) {
    log.error(`error no chat id`);
    return res.sendStatus(400);
  }

  if (!req.body.destinationAddress) {
    log.error(`error no destination  address`);
    return res.status(200).send({
      status: 'fail',
      error: 'no destination address',
    });
  }

  if (!req.body.amount) {
    log.error(`error no amount`);
    return res.status(200).send({
      status: 'fail',
      error: 'no withdraw amount',
    });
  }
  const chatId = req.body.chatId.toString();

  const destinationAddress: string = req.body.destinationAddress;
  const amount: number = req.body.amount;

  if (amount === undefined) {
    log.error('Error: no amount found');
    const response = {
      body: {},
      error: 'no amount was found',
      status: 'fail',
    };
    return res.status(200).send(response);
  }

  const amountBn = new BigNumber(amount);
  if (amountBn.isNegative()) {
    log.error('Error: invalid amount');
    const tradingResponse = {
      body: {},
      error: 'invalid amount',
      status: 'fail',
    };
    return res.status(200).send(tradingResponse);
  }

  if (!isAddress(destinationAddress)) {
    log.error('Error: invalid address');
    const tradingResponse = {
      body: {},
      error: 'invalid address',
      status: 'fail',
    };
    return res.status(200).send(tradingResponse);
  }

  const transaction = await sequelize.transaction();

  try {
    const user = await User.findOne({
      where: {
        chatId,
      },
    });

    if (!user) {
      await transaction.rollback();
      return res.status(200).send({
        status: 'fail',
        error: 'user not found',
      });
    }

    const usdcAmount = amountBn
      .multipliedBy(1e6)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const isSuccess = await decreaseBalanceHelper(
      user.evmAddress,
      usdcAmount.toString(),
      transaction
    );

    if (!isSuccess) {
      await transaction.rollback();
      log.error('Error: Insufficient user balance');
      const tradingResponse = {
        body: {},
        error: 'Insufficient user balance',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    await WithdrawTransactions.create(
      {
        address: user.evmAddress,
        status: 'PENDING',
        amount: usdcAmount.toString(),
        destinationAddress,
      },
      { transaction }
    );

    await transaction.commit();
    return res.status(200).send({
      status: 'success',
    });
  } catch (error: any) {
    await transaction.rollback();
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const checkPendingWithdrawals = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const transactions = await WithdrawTransactions.findAll({
      where: {
        status: 'PENDING',
      },
    });

    if (transactions.length < 1) {
      return res.status(200).send({});
    }

    const priceFeed = new ethers.Contract(
      config.ethereum.chainlink.ethPriceFeed,
      v3Aggregator.abi,
      ethereumProvider
    );

    const mainWallet = new ethers.Wallet(
      config.wallets.mainWallet.key,
      ethereumProvider
    );

    const feesObject = await getFeeObject(ethereumProvider);

    if (feesObject === null) {
      return res.status(200).send({});
    }

    const priceData = await priceFeed.latestRoundData();
    const answer = new BigNumber(priceData.answer as string).dividedBy(1e18);

    for await (const transaction of transactions) {
      const initialAmountBn = new BigNumber(transaction.amount).dividedBy(1e6);

      if (initialAmountBn.gte(200)) {
        if (!transaction.approved) {
          continue;
        }
      }

      const amountOfEth = initialAmountBn
        .multipliedBy(answer)
        .decimalPlaces(5, BigNumber.ROUND_DOWN)
        .multipliedBy(1e18);

      const txDetails = {
        to: transaction.destinationAddress,
        value: amountOfEth.toString(),
        maxPriorityFeePerGas: feesObject.maxPriorityFeePerGas,
        maxFeePerGas: feesObject.maxFeePerGas,
      };

      const tx = await mainWallet.sendTransaction(txDetails);

      await WithdrawTransactions.update(
        {
          transferTxHash: tx.hash,
          status: 'PROCESSED',
        },
        {
          where: {
            id: transaction.id,
          },
        }
      );
    }

    return res.status(200).send({});
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};
