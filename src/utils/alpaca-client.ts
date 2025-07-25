import Alpaca from '@alpacahq/alpaca-trade-api';

import { config } from '../config';

const alpacaClient = new Alpaca({
  keyId: config.alpaca.key,
  secretKey: config.alpaca.secret,
  // paper: true,
});

export { alpacaClient };
