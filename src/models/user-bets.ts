import {
  DataTypes,
  Model,
} from 'sequelize';

import { sequelize } from '../db';

export class UserBets extends Model {
  declare id: bigint;
  public address!: string;
  public asset!: string;
  public side!: string;
  public amount!: number;
  public leverage!: number;
  public status!: string;
  public entryPrice!: string;
  public exitPrice!: string;
  public bustPrice!: string;
  public uuid!: string;
  public pnl!: number;
  public assetType!: string;
  public userStopLossPrice!: string;
  public userTakeProfitPrice!: string;
  public upfrontFee!: number;
  public fee!: number;

  public createdAt!: string;
  public updatedAt!: string;
}

UserBets.init(
  {
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    address: {
      field: 'address',
      allowNull: false,
      type: DataTypes.STRING,
    },
    asset: {
      allowNull: false,
      type: DataTypes.STRING,
      defaultValue: '0',
    },
    side: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    amount: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    leverage: {
      allowNull: false,
      type: DataTypes.REAL,
    },
    status: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    entryPrice: {
      field: 'entry_price',
      type: DataTypes.STRING,
    },
    exitPrice: {
      field: 'exit_price',
      type: DataTypes.STRING,
    },
    bustPrice: {
      field: 'bust_price',
      type: DataTypes.STRING,
    },
    fee: {
      field: 'fee',
      type: DataTypes.DOUBLE,
    },
    pnl: {
      field: 'pnl',
      type: DataTypes.DOUBLE,
    },
    assetType: {
      field: 'asset_type',
      type: DataTypes.STRING,
    },

    userStopLossPrice: {
      field: 'user_stop_loss_price',
      type: DataTypes.STRING,
    },
    takeProfitPrice: {
      field: 'user_take_profit_price',
      type: DataTypes.STRING,
    },

    upfrontFee: {
      field: 'upfront_fee',
      type: DataTypes.DOUBLE,
    },

    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: 'user_bets',
    schema: 'public',
    underscored: true,
  }
);
