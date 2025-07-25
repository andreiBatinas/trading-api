import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

export const getFeeObject = async (provider: any) => {
  const block = await provider.getBlock('latest');
  if (block === undefined || block === null) {
    return null;
  }

  if (block.baseFeePerGas === undefined || block.baseFeePerGas === null) {
    return null;
  }
  const block_number = block.number;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const base_fee = parseFloat(ethers.formatUnits(block.baseFeePerGas, 'gwei'));

  const max_priority_fee_hex = await provider.send(
    'eth_maxPriorityFeePerGas',
    []
  );

  const max_priority_fee_wei =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new BigNumber(max_priority_fee_hex).toNumber();
  const max_priority_fee = parseFloat(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ethers.formatUnits(max_priority_fee_wei, 'gwei')
  );

  let max_fee_per_gas = base_fee + max_priority_fee;

  //  In case the network gets (up to 10%) more congested
  max_fee_per_gas += base_fee * 0.1;

  //  cast gwei numbers to wei BigNumbers for ethers
  const maxFeePerGasRaw = ethers.parseUnits(max_fee_per_gas.toFixed(9), 'gwei');
  const maxPriorityFeePerGasRaw = ethers.parseUnits(
    max_priority_fee.toFixed(9),
    'gwei'
  );

  const maxFeePerGas = new BigNumber(maxFeePerGasRaw.toString()).toString();
  const maxPriorityFeePerGas = new BigNumber(
    maxPriorityFeePerGasRaw.toString()
  ).toString();
  //  Final object ready to feed into a transaction
  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
};
