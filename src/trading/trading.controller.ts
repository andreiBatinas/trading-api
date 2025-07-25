import axios from 'axios';
/* eslint-disable no-shadow */
import BigNumber from 'bignumber.js';
import { NextFunction, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { Op } from 'sequelize';

import { config } from '../config';
import { DB, sequelize } from '../db';
import { Logger } from '../logger';
import { User, UserBets } from '../models';
import { Redis } from '../redis';
import {
  decreaseBalanceHelper,
  increaseAmountHelper,
} from '../user/user.balance';
import { alpacaClient } from '../utils/alpaca-client';
import { isNumeric } from '../utils/validation';
import {
  RawOrder,
  STOCK_MARKET_DAYS_OFF,
  STOCK_MARKET_TIME,
  TradingResponse,
  assetNameToUserAssetName,
  existingStocksAssetList,
} from './trading.types';

const db = new DB();

const log = new Logger('Trading');

const isStockMarketOpen = (): { state: boolean; reason: string | null } => {
  const { openTimeUtc, closeTimeUtc } = STOCK_MARKET_TIME;

  const utcDate = new Date(
    (Date.now() / 1000 + new Date().getTimezoneOffset() * 60) * 1000
  );

  const today = DateTime.utc();
  const dayOff = STOCK_MARKET_DAYS_OFF.find((item) => {
    const dtOffDay = DateTime.fromObject(item.dateObj, { zone: 'utc' });
    return (
      today.startOf('day').toMillis() === dtOffDay.startOf('day').toMillis()
    );
  });

  if (!!dayOff) return { state: false, reason: dayOff.reason.title };

  if (today.weekday === 6 || today.weekday === 7)
    return { state: false, reason: null };

  const YYYY = utcDate.getFullYear();
  const MM = utcDate.getMonth();
  const DD = utcDate.getDate();

  const [oh, om, os = '00'] = openTimeUtc.split(':');
  const [ch, cm, cs = '00'] = closeTimeUtc.split(':');

  const openDateUtc = new Date(
    YYYY,
    MM,
    DD,
    parseInt(oh, 10),
    parseInt(om, 10),
    parseInt(os, 10)
  );
  const closeDateUtc = new Date(
    YYYY,
    MM,
    DD,
    parseInt(ch, 19),
    parseInt(cm, 10),
    parseInt(cs, 10)
  );

  const utcTimeStamp = utcDate.getTime();
  const openTimeStamp = openDateUtc.getTime();
  const closeTimeStamp = closeDateUtc.getTime();

  if (utcTimeStamp > openTimeStamp && utcTimeStamp < closeTimeStamp)
    return { state: true, reason: null };

  return { state: false, reason: null };
};

const getUserLast24Bids = async (address: string) => {
  const yesterDayDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  const now = new Date();

  const bidsCount = await UserBets.count({
    where: {
      address,
      createdAt: {
        [Op.between]: [yesterDayDate, now],
      },
    },
  });

  return bidsCount;
};

export const calculateFees = async (amount: number, address: string) => {
  const userLast24HoursBids = await getUserLast24Bids(address);

  let feePercentage = '0';
  if (userLast24HoursBids > config.leverageTrading.fees.feeTiers.freeTierBids) {
    feePercentage =
      config.leverageTrading.fees.feeTiersPercentage.secondTierFees;
  }

  if (
    userLast24HoursBids > config.leverageTrading.fees.feeTiers.secondTierBids
  ) {
    feePercentage =
      config.leverageTrading.fees.feeTiersPercentage.thirdTierFees;
  }

  if (
    userLast24HoursBids > config.leverageTrading.fees.feeTiers.thirdTierBids
  ) {
    feePercentage =
      config.leverageTrading.fees.feeTiersPercentage.fourthTierFees;
  }

  const originalAmountBn = new BigNumber(amount);
  const feePercentageBn = new BigNumber(feePercentage);

  const feeAmountBn = originalAmountBn
    .multipliedBy(feePercentageBn)
    .decimalPlaces(2);

  const newAmountBn = originalAmountBn.minus(feeAmountBn).decimalPlaces(2, 1);

  return {
    newAmount: newAmountBn.toNumber(),
    feeAmount: feeAmountBn.toNumber(),
  };
};

export const calculatePnL = (
  entryPrice: string,
  currentPrice: string,
  amount: number,
  leverage: number,
  side: string
) => {
  const entry = new BigNumber(entryPrice);
  const current = new BigNumber(currentPrice);
  const betAmount = new BigNumber(amount);
  const lev = new BigNumber(leverage);

  // Calculate the position size.
  const positionSize = betAmount.multipliedBy(lev);

  if (side === 'up') {
    // For a long position:
    const pnl = current
      .minus(entry)
      .multipliedBy(positionSize.dividedBy(entry));
    return pnl;
  } else if (side === 'down') {
    // For a short position:
    const pnl = entry
      .minus(current)
      .multipliedBy(positionSize.dividedBy(entry));
    return pnl;
  } else {
    console.error("Invalid side. Must be 'up' or 'down'");
    return null;
  }
};

export const calculateBustPrice = (
  betAmount: number,
  leverage: number,
  entryPrice: number,
  side: string
): BigNumber | null => {
  if (leverage < 1 || leverage > 1000 || entryPrice <= 0 || betAmount <= 0) {
    console.error('Invalid input values');
    return null;
  }

  const positionSize = new BigNumber(betAmount).times(leverage);
  const quantity = positionSize.dividedBy(entryPrice);

  let bustPrice: BigNumber;

  if (side === 'up') {
    // Long position bust price
    bustPrice = new BigNumber(betAmount)
      .minus(positionSize)
      .dividedBy(quantity);
  } else if (side === 'down') {
    // Short position bust price
    bustPrice = new BigNumber(betAmount).plus(positionSize).dividedBy(quantity);
  } else {
    console.error("Invalid side. Must be 'up' or 'down'");
    return null;
  }

  // Ensure the bust price is positive
  return bustPrice.abs();
};

export const createTrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.chatId) {
    log.error(`error no chat id`);
    return res.sendStatus(400);
  }

  const transaction = await sequelize.transaction();

  try {
    const rawOrder: RawOrder = req.body;

    if (rawOrder.asset === undefined) {
      log.error('Error: no asset found');
      await transaction.rollback();
      const response: TradingResponse = {
        body: {},
        error: 'no asset was found',
        status: 'fail',
      };

      return res.status(200).send(response);
    }

    if (rawOrder.asset === 'LADYS/USD') {
      log.error('Error: asset restricted');
      await transaction.rollback();
      const response = {
        body: {},
        code: 'RESTRICTED',
        error: 'asset restricted',
        status: 'fail',
      };

      return res.status(200).send(response);
    }

    if (rawOrder.side === undefined) {
      await transaction.rollback();
      log.error('Error: no side found');
      const response: TradingResponse = {
        body: {},
        error: 'no side was found',
        status: 'fail',
      };
      return res.status(200).send(response);
    }

    if (rawOrder.amount === undefined) {
      await transaction.rollback();
      log.error('Error: no amount found');
      const response: TradingResponse = {
        body: {},
        error: 'no amount was found',
        status: 'fail',
      };
      return res.status(200).send(response);
    }

    if (!isNumeric(rawOrder.amount)) {
      await transaction.rollback();
      log.error('Error: invalid type');
      const tradingResponse: TradingResponse = {
        body: {},
        error: 'invalid type',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    if (rawOrder.leverage === undefined) {
      await transaction.rollback();
      log.error('Error: no leverage found');
      // eslint-disable-next-line no-shadow
      const response: TradingResponse = {
        body: {},
        error: 'no leverage was found',
        status: 'fail',
      };
      return res.status(200).send(response);
    }

    if (!isNumeric(rawOrder.leverage)) {
      await transaction.rollback();
      log.error('Error: invalid type leverage');
      const tradingResponse: TradingResponse = {
        body: {},
        error: 'invalid type leverage',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    if (rawOrder.leverage < 1) {
      await transaction.rollback();
      log.error('Error: invalid leverage');
      const tradingResponse: TradingResponse = {
        body: {},
        error: 'invalid leverage',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    if (rawOrder.leverage > 1000) {
      await transaction.rollback();
      log.error('Error: invalid leverage');
      const tradingResponse: TradingResponse = {
        body: {},
        error: 'invalid leverage',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    if (rawOrder.assetType === undefined) {
      await transaction.rollback();
      log.error('Error: no assetType found');
      // eslint-disable-next-line no-shadow
      const response: TradingResponse = {
        body: {},
        error: 'no assetType was found',
        status: 'fail',
      };
      return res.status(200).send(response);
    }

    // const internalAssetName = userAssetNameToAssetName[rawOrder.asset];

    // if (internalAssetName === undefined) {
    //   await transaction.rollback();
    //   const response: TradingResponse = {
    //     body: {},
    //     error: 'asset not good',
    //     status: 'fail',
    //   };
    //   return res.status(200).send(response);
    // }

    const chatId = req.body.chatId.toString();

    const user = await User.findOne({
      where: {
        chatId,
      },
      attributes: ['evmAddress'],
    });

    if (!user) {
      await transaction.rollback();
      return res.status(200).send({
        status: 'fail',
        error: 'user not found',
      });
    }

    const address = user.evmAddress;

    const totalCountRes = await db.query(
      `SELECT count(*) as count FROM user_bets WHERE address=$1 AND status='live'`,
      [address]
    );

    const totalCount = totalCountRes.rows[0].count;

    if (totalCount > 5) {
      await transaction.rollback();
      // eslint-disable-next-line no-shadow
      const response: TradingResponse = {
        body: {},
        error: 'Max of 5 live orders are allowed per user',
        status: 'fail',
      };
      return res.status(200).send(response);
    }

    const amountDecimalBN = new BigNumber(rawOrder.amount);

    if (amountDecimalBN.lte(0)) {
      await transaction.rollback();
      log.error('Error: amount incorrect');
      const tradingResponse: TradingResponse = {
        body: {},
        error: 'amount incorrect',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    const { feeAmount, newAmount } = await calculateFees(
      rawOrder.amount,
      address
    );

    const amountBN = amountDecimalBN.multipliedBy(1e6);

    const isSuccess = await decreaseBalanceHelper(
      address,
      amountBN.toString(),
      transaction
    );

    if (!isSuccess) {
      await transaction.rollback();
      log.error('Error: Insufficient user balance');
      const tradingResponse: TradingResponse = {
        body: {},
        error: 'Insufficient user balance',
        status: 'fail',
      };
      return res.status(200).send(tradingResponse);
    }

    // TODO: create user bets

    const cryptoAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverCryptoQuotes
    );

    const stocksAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverStocksQuotes
    );

    let foundAsset = cryptoAssetQuotes.find(
      (asset: any) => asset.symbol === rawOrder.asset
    );

    let type = 'crypto';

    if (foundAsset === undefined) {
      foundAsset = stocksAssetQuotes.find(
        (asset: any) => asset.symbol === rawOrder.asset
      );
      type = 'stock';
    }

    if (type === 'stock') {
      const isOpen = isStockMarketOpen();
      if (!isOpen.state) {
        await transaction.rollback();
        log.error('Error: stock market closed');
        const tradingResponse = {
          body: {},
          error: 'stock market closed',
          code: 'MARKET_CLOSED',
          status: 'fail',
        };
        return res.status(200).send(tradingResponse);
      }
    }

    if (foundAsset === undefined) {
      throw new Error('undefined asset');
    }

    const entryPrice = Number(foundAsset.price);

    let bustPrice = calculateBustPrice(
      newAmount,
      rawOrder.leverage,
      entryPrice,
      rawOrder.side
    );

    if (bustPrice === null) {
      throw new Error('error calculating bust price');
    }

    if (type === 'stock') {
      bustPrice = bustPrice.decimalPlaces(2, BigNumber.ROUND_DOWN);
    }

    await UserBets.create(
      {
        address,
        asset: rawOrder.asset,
        side: rawOrder.side,
        amount: newAmount,
        leverage: rawOrder.leverage,
        status: 'live',
        entryPrice: entryPrice.toString(),
        bustPrice: bustPrice.toString(),
        assetType: type,
        userStopLossPrice: rawOrder.userStopLossPrice,
        userTakeProfitPrice: rawOrder.userTakeProfitPrice,
        upfrontFee: feeAmount,
      },
      { transaction }
    );

    const response: TradingResponse = {
      body: {},
      status: 'success',
    };

    await transaction.commit();

    return res.status(201).send(response);
  } catch (error: any) {
    await transaction.rollback();
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const closeTrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.chatId) {
    log.error(`error no chat id`);
    return res.sendStatus(400);
  }

  if (!req.body.id) {
    log.error(`error no  id`);
    return res.sendStatus(400);
  }

  const chatId = req.body.chatId.toString();

  const transaction = await sequelize.transaction();

  try {
    const user = await User.findOne({
      where: {
        chatId,
      },
      attributes: ['evmAddress'],
    });

    if (!user) {
      await transaction.rollback();
      return res.status(200).send({
        status: 'fail',
        error: 'user not found',
      });
    }

    const id: number = req.body.id;

    const position = await UserBets.findOne({
      where: {
        id,
        status: 'live',
        address: user.evmAddress,
      },
    });

    if (position === null) {
      await transaction.rollback();
      return res.status(200).send({
        status: 'fail',
        error: 'position not found',
      });
    }

    // TODO: check double spend for this user and position id

    const cryptoAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverCryptoQuotes
    );

    const stocksAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverStocksQuotes
    );

    let foundAsset = cryptoAssetQuotes.find(
      (asset: any) => asset.symbol === position.asset
    );

    if (foundAsset === undefined) {
      foundAsset = stocksAssetQuotes.find(
        (asset: any) => asset.symbol === position.asset
      );
    }

    const currentPrice: string = foundAsset.price;
    const entryPrice = position.entryPrice;
    const amount = position.amount;
    const leverage = position.leverage;
    const side = position.side;

    const pnl = calculatePnL(entryPrice, currentPrice, amount, leverage, side);

    if (pnl === null) {
      await transaction.rollback();
      return res.status(200).send({
        status: 'fail',
        error: 'position problem',
      });
    }
    let pnlAfterFees = pnl;
    let betFees = 0;

    if (pnl.isPositive()) {
      const fees = pnl.multipliedBy(config.leverageTrading.fees.winnings);
      betFees = fees.decimalPlaces(4, BigNumber.ROUND_DOWN).toNumber();
      pnlAfterFees = pnl.minus(fees);
    } else {
      betFees = pnl.decimalPlaces(4, BigNumber.ROUND_DOWN).toNumber();
    }

    let total = pnlAfterFees.plus(amount);

    if (total.lt(0)) {
      total = new BigNumber(0);
    }

    const amountToIncrease = total
      .decimalPlaces(6, BigNumber.ROUND_DOWN)
      .multipliedBy(1e6);

    if (amountToIncrease.gt(0)) {
      await increaseAmountHelper(
        user.evmAddress,
        amountToIncrease.toString(),
        transaction
      );
    }

    await UserBets.update(
      {
        exitPrice: currentPrice.toString(),
        pnl: pnlAfterFees.toString(),
        status: 'closed',
        fee: betFees,
      },
      {
        where: {
          id: position.id,
        },
        transaction,
      }
    );
    await transaction.commit();
    return res.status(200).send({});
  } catch (error: any) {
    await transaction.rollback();
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const listMarkets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // const assetList: any = [];

    // const markets = await alpacaClient.getAssets({
    //   status: 'active',
    //   asset_class: 'crypto',
    // });

    // markets.map((market: any) => {
    //   assetList.push(market.symbol);
    // });

    // console.log(assetList);

    const stocksQuoteList: any = [];

    const quotes = await alpacaClient.getLatestQuotes(existingStocksAssetList);

    quotes.forEach((value, key) => {
      if (value.BidPrice !== 0) {
        const midPrice = (value.BidPrice + value.AskPrice) / 2;
        stocksQuoteList.push({
          symbol: key,
          price: midPrice.toFixed(2),
        });
      }
    });

    Redis.setJSON(config.redis.prefix.serverStocksQuotes, stocksQuoteList);

    const quoteList: any = [];
    const data = await axios({
      method: 'get',
      url: 'https://api.bybit.com/v5/market/tickers?category=linear',
      params: {},
      headers: {},
    });

    const assets = data.data.result.list;

    assets.map((asset: any) => {
      const symbol = asset.symbol;

      const frontendName = assetNameToUserAssetName[symbol];
      if (frontendName === undefined) {
        return null;
      }

      quoteList.push({
        symbol: frontendName,
        price: asset.markPrice,
      });
    });

    Redis.setJSON(config.redis.prefix.serverCryptoQuotes, quoteList);

    return res.status(200).send(quoteList);
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const checkBusted = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const positions = await UserBets.findAll({
      where: {
        status: 'live',
      },
    });

    if (positions.length === 0) {
      return res.status(200).send();
    }
    const cryptoAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverCryptoQuotes
    );

    const stocksAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverStocksQuotes
    );

    const bustedPromises = positions.map(async (position) => {
      let foundAsset = cryptoAssetQuotes.find(
        (asset: any) => asset.symbol === position.asset
      );

      if (foundAsset === undefined) {
        foundAsset = stocksAssetQuotes.find(
          (asset: any) => asset.symbol === position.asset
        );
      }

      if (position.side === 'up') {
        const currentPrice = new BigNumber(foundAsset.price as number);
        const bustPrice = new BigNumber(position.bustPrice);

        if (currentPrice.lte(bustPrice)) {
          await UserBets.update(
            {
              exitPrice: bustPrice.toString(),
              pnl: -position.amount,
              status: 'busted',
            },
            {
              where: {
                id: position.id,
              },
            }
          );
        }
      } else if (position.side === 'down') {
        const currentPrice = new BigNumber(foundAsset.price as number);
        const bustPrice = new BigNumber(position.bustPrice);

        if (currentPrice.gte(bustPrice)) {
          await UserBets.update(
            {
              exitPrice: bustPrice.toString(),
              pnl: position.amount,
              status: 'busted',
            },
            {
              where: {
                id: position.id,
              },
            }
          );
        }
      }
    });

    await Promise.all(bustedPromises);

    return res.status(200).send();
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const getOpenPositions = async (
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
      attributes: ['evmAddress'],
    });

    if (!user) {
      return res.status(200).send({
        status: 'fail',
        error: 'user not found',
      });
    }

    const cryptoAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverCryptoQuotes
    );

    const stocksAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverStocksQuotes
    );

    const openPositions: any = [];

    const dbPositions = await UserBets.findAll({
      where: {
        address: user.evmAddress,
        status: 'live',
      },
    });

    dbPositions.map((position: any) => {
      let foundAsset;

      if (position.assetType === 'crypto') {
        foundAsset = cryptoAssetQuotes.find(
          (asset: any) => asset.symbol === position.asset
        );
      } else if (position.assetType === 'stock') {
        foundAsset = stocksAssetQuotes.find(
          (asset: any) => asset.symbol === position.asset
        );
      }

      const pnl = calculatePnL(
        position.entryPrice as string,
        foundAsset.price as string,
        position.amount as number,
        position.leverage as number,
        position.side as string
      );

      let normalizedPnl = '0';
      if (pnl === null) {
        normalizedPnl = '0';
      } else {
        normalizedPnl = pnl.toFixed(3, BigNumber.ROUND_DOWN);
      }

      openPositions.push({
        id: position.id,
        amount: position.amount,
        price: foundAsset.price,
        asset: position.asset,
        leverage: position.leverage,
        status: position.status,
        entryPrice: position.entryPrice,
        bustPrice: position.bustPrice,
        pnl: normalizedPnl,
        side: position.side,
      });
    });

    return res.status(200).send(openPositions);
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const getClosedPositions = async (
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
      attributes: ['evmAddress'],
    });

    if (!user) {
      return res.status(200).send({
        status: 'fail',
        error: 'user not found',
      });
    }

    const positions = await UserBets.findAll({
      where: {
        address: user.evmAddress,
        status: {
          [Op.or]: ['closed', 'busted'],
        },
      },
    });

    return res.status(200).send(positions);
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const getTradingAssets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cryptoAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverCryptoQuotes
    );

    const stocksAssetQuotes = await Redis.getJSON(
      config.redis.prefix.serverStocksQuotes
    );

    const assets = {
      crypto: cryptoAssetQuotes,
      stocks: stocksAssetQuotes,
    };

    return res.status(200).send(assets);
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};
