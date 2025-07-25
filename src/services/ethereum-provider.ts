import { ethers } from 'ethers';

import { config } from '../config';

const alchemyKey = config.ethereum.rpcKey;

const mainnet = 'homestead';

export const ethereumProvider = new ethers.AlchemyProvider(mainnet, alchemyKey);
