import express from 'express';

import {
  checkBusted,
  closeTrade,
  createTrade,
  getClosedPositions,
  getOpenPositions,
  getTradingAssets,
  listMarkets,
} from './trading.controller';

export const tradingRouter = express.Router();

tradingRouter.post('/create-trade', createTrade);

tradingRouter.post('/close-trade', closeTrade);

tradingRouter.post('/markets/get-available', listMarkets);

tradingRouter.post('/check-bust', checkBusted);

tradingRouter.post('/open-positions', getOpenPositions);
tradingRouter.post('/closed-positions', getClosedPositions);

tradingRouter.get('/trading-assets', getTradingAssets);
