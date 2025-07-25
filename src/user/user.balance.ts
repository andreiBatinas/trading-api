import BigNumber from 'bignumber.js';
import { QueryTypes, Transaction } from 'sequelize';

import { sequelize } from '../db';
import { Logger } from '../logger';

const log = new Logger('UserBalance');

export const decreaseBalanceHelper = async (
  address: string,
  amount: string,
  t?: Transaction
) => {
  if (typeof t === 'undefined') {
    return await decreaseBalanceHelperWithoutTransaction(address, amount);
  } else {
    return await decreaseBalanceHelperWithTransaction(address, amount, t);
  }
};

export const decreaseBalanceHelperWithoutTransaction = async (
  address: string,
  amount: string
) => {
  log.info(`[DECREASE_BALANCE] Address: ${address} ${JSON.stringify(amount)}`);

  const newAmount = new BigNumber(amount).toFixed(0, 1);

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const updateResult = await sequelize.query(
        `
            UPDATE public.user
            SET balance  = cast(balance as decimal) - cast($1 as decimal)
            WHERE evm_address = $2 and cast(balance as decimal) >= cast($1 as decimal)
            RETURNING balance;
        `,
        {
          bind: [newAmount, address],
          transaction,
          type: QueryTypes.UPDATE,
        }
      );
      return updateResult;
    });

    if (result[1] === 0) {
      return false;
    }

    if (result[0] === undefined) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

export const decreaseBalanceHelperWithTransaction = async (
  address: string,
  amount: string,
  transaction?: Transaction
) => {
  const newAmount = new BigNumber(amount).toFixed(0, 1);

  const updateResult = await sequelize.query(
    `
        UPDATE public.user
        SET balance  = cast(balance as decimal) - cast($1 as decimal)
        WHERE evm_address = $2 and cast(balance as decimal) >= cast($1 as decimal)
        RETURNING balance;
    `,
    {
      bind: [newAmount, address],
      transaction,
      type: QueryTypes.UPDATE,
    }
  );

  if (updateResult[1] === 0) {
    return false;
  }

  if (updateResult[0] === undefined) {
    return false;
  }

  return true;
};

export const increaseAmountHelper = async (
  address: string,
  amount: string,
  t?: Transaction
) => {
  if (typeof t === 'undefined') {
    await increaseAmountHelperWithoutTransaction(address, amount);
  } else {
    await increaseAmountHelperWithTransaction(address, amount, t);
  }
};

const increaseAmountHelperWithoutTransaction = async (
  address: string,
  amount: string
) => {
  log.info(`[INCREASE_BALANCE] Address: ${address} ${JSON.stringify(amount)}`);

  const newAmount = new BigNumber(amount).toFixed(0, 1);

  const result = await sequelize.transaction(async (transaction) => {
    const increaseBalanceResult = await increaseUserBalanceAmount(
      address,
      newAmount,
      transaction
    );
    return increaseBalanceResult;
  });

  if (result[1] === 0) {
    return false;
  }

  if (result[0] === undefined) {
    return false;
  }

  const resultArray = result[0] as any;
  const amountObj = resultArray[0];
  const totalAmount = amountObj.amount as string;

  log.info(`[BALANCE_INCREASED] Address: ${address} ${JSON.stringify(result)}`);
};

const increaseAmountHelperWithTransaction = async (
  address: string,
  amount: string,
  transaction: Transaction
) => {
  log.info(`[INCREASE_BALANCE] Address: ${address} ${JSON.stringify(amount)}`);

  const newAmount = new BigNumber(amount).toFixed(0, 1);

  const increaseBalanceResult = await increaseUserBalanceAmount(
    address,
    newAmount,
    transaction
  );

  if (increaseBalanceResult[1] === 0) {
    return false;
  }

  if (increaseBalanceResult[0] === undefined) {
    return false;
  }

  const resultArray = increaseBalanceResult[0] as any;
  const amountObj = resultArray[0];
  const totalAmount = amountObj.amount as string;

  log.info(
    `[BALANCE_INCREASED] Address: ${address} ${JSON.stringify(
      increaseBalanceResult
    )}`
  );
};

const increaseUserBalanceAmount = async (
  address: string,
  amount: string,
  transaction: Transaction
) => {
  const updateResult = await sequelize.query(
    `
            UPDATE public.user
            SET balance  = cast(balance as decimal) + cast($1 as decimal)
            WHERE evm_address = $2
            RETURNING balance;
            `,
    {
      bind: [amount, address],
      transaction,
      type: QueryTypes.UPDATE,
    }
  );

  return updateResult;
};
