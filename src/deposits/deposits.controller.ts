import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { NextFunction, Request, Response } from 'express';

import { v3Aggregator } from '../abis/V3Aggregator';
import { config } from '../config';
import { sequelize } from '../db';
import { Logger } from '../logger';
import { EthereumDepositTransactions, User } from '../models';
import { ethereumProvider } from '../services/ethereum-provider';
import { getFeeObject } from '../services/gas-station';
import { increaseAmountHelper } from '../user/user.balance';

const log = new Logger('Deposits');

export const ethereumDepositsNew = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await User.findAll({
      attributes: ['evmAddress', 'evmPrivateAddress'],
    });

    if (users.length < 1) {
      log.error('There are no accounts in the system');
      return res.status(200).send({});
    }
    const feederAddress: string = config.wallets.mainWallet.address;

    const feesObject = await getFeeObject(ethereumProvider);

    if (feesObject === null) {
      log.error('fee object is null');
      return res.status(200).send({});
    }

    for await (const user of users) {
      const proxyWallet = new ethers.Wallet(
        user.evmPrivateAddress,
        ethereumProvider
      );

      const balanceOfProxyWallet = (
        await ethereumProvider.getBalance(proxyWallet.getAddress())
      ).toString();

      const minimumNumberOfEth = ethers.parseEther(
        config.ethereum.ethereumThreshold
      );

      if (
        new BigNumber(balanceOfProxyWallet).gte(
          new BigNumber(minimumNumberOfEth.toString())
        )
      ) {
        const maxFeePerGas = feesObject.maxFeePerGas;
        const proxyWalletEthValueBN = new BigNumber(balanceOfProxyWallet);
        const maxFeePerGasBN = new BigNumber(maxFeePerGas).times(21000);

        const ethToSendBN = proxyWalletEthValueBN.minus(maxFeePerGasBN);

        const txDetails = {
          to: feederAddress,
          value: ethToSendBN.toString(),
          maxPriorityFeePerGas: feesObject.maxPriorityFeePerGas,
          maxFeePerGas: feesObject.maxFeePerGas,
        };

        const tx = await proxyWallet.sendTransaction(txDetails);

        await EthereumDepositTransactions.create({
          address: proxyWallet.address,
          status: 'PENDING',
          depositTxHash: tx.hash,
          assetType: 'ETH',
          assetAmount: ethToSendBN.toString(),
        });
      }
    }

    return res.status(200).send({});
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};

export const ethereumDepositsPending = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const transactions = await EthereumDepositTransactions.findAll({
      where: {
        status: 'PENDING',
        assetType: 'ETH',
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

    const priceData = await priceFeed.latestRoundData();
    const answer = new BigNumber(priceData.answer as string).dividedBy(1e18);
    const usdcPrice = new BigNumber(1)
      .dividedBy(answer)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const results = transactions.map(async (transaction) => {
      const receipt = await ethereumProvider.getTransactionReceipt(
        transaction.depositTxHash
      );

      if (!receipt || receipt.status !== 1) {
        return null;
      }

      const initialAmountBn = new BigNumber(transaction.assetAmount).dividedBy(
        1e18
      );

      const usdcAmountToSend = initialAmountBn
        .multipliedBy(usdcPrice)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .minus(config.fees.bridgeCost)
        .multipliedBy(1e6);

      try {
        await sequelize.transaction(async (t) => {
          await increaseAmountHelper(
            transaction.address,
            usdcAmountToSend.toString(),
            t
          );

          await EthereumDepositTransactions.update(
            {
              stableAmount: usdcAmountToSend.toString(),
              status: 'SUCCESS',
            },
            {
              where: {
                id: transaction.id,
              },
              transaction: t,
            }
          );
        });
      } catch (error) {
        log.error(
          `Error while increasing amount and setting to processsed ${transaction.id} for user ${transaction.address}`
        );
      }
    });
    await Promise.all(results);
    return res.status(200).send({});
  } catch (error: any) {
    log.error(`error ${error.message}`);
    next(error);
  }
};
