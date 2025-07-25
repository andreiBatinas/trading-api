const dbUser = '1';
const dbPassword = '1';
const dbHost = '1';
const dbPort = '1';
const dbDatabase = '1';

const sslCACertPath: string | undefined = undefined;

export const config = {
  express: {
    port: 9400,
  },
  db: {
    trading: {
      connectionString: `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabase}`,
      sslCACertPath,
    },
    ssl: 'false',
  },
  alpaca: {
    key: '1',
    secret: '1',
  },

  redis: {
    url: 'rediss://',
    prefix: {
      chatIdUserInfo: 'trading:user:id:',
      serverCryptoQuotes: 'server:crypto:quotes',
      serverStocksQuotes: 'server:stocks:quotes',
    },
  },
  fees: {
    threshold: '4',
    bridgeCost: '0.50',
  },

  jwt: {
    secret: 'somesecretstoredAfely~!@!!',
    algorithms: ['HS256' as const],
  },

  bots: {
    botHeader: 'x-trading',
    botHeaderKey: '58e7c304-d7db-4d56-8d6a-2ffed0a0065b',
  },

  ethereum: {
    rpcKey: '23232',
    ethereumThreshold: '0.005',
    chainlink: {
      ethPriceFeed: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
    },
  },

  wallets: {
    mainWallet: {
      address: 'someaddress',
      key: 'somekey',
    },
  },

  leverageTrading: {
    fees: {
      feeTiers: {
        freeTierBids: 5,
        secondTierBids: 20,
        thirdTierBids: 100,
      },
      feeTiersPercentage: {
        secondTierFees: '0.05',
        thirdTierFees: '0.075',
        fourthTierFees: '0.1',
      },
      winnings: '0.1',
    },
  },
};
