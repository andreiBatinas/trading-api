import { DataTypes, Model } from 'sequelize';

import { sequelize } from '../db';

export class EthereumDepositTransactions extends Model {
  declare id: bigint;
  public address!: string;
  public depositTxHash!: string;
  public transferTxHash!: string;
  public status!: string;
  public assetType!: string;
  public assetAmount!: string;
  public stableAmount!: string;
  public updatedAt!: string;
}

EthereumDepositTransactions.init(
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
    status: {
      field: 'status',
      allowNull: false,
      type: DataTypes.STRING,
    },
    depositTxHash: {
      field: 'deposit_tx_hash',
      allowNull: false,
      type: DataTypes.STRING,
    },
    transferTxHash: {
      field: 'transfer_tx_hash',
      allowNull: true,
      type: DataTypes.STRING,
    },
    assetType: {
      field: 'asset_type',
      allowNull: false,
      type: DataTypes.STRING,
    },
    assetAmount: {
      field: 'asset_amount',
      allowNull: false,
      type: DataTypes.STRING,
    },
    stableAmount: {
      field: 'stable_amount',
      allowNull: true,
      type: DataTypes.STRING,
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: 'ethereum_deposit_transactions',
    schema: 'public',
    underscored: true,
  }
);
