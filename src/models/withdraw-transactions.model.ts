import { DataTypes, Model } from 'sequelize';

import { sequelize } from '../db';

export class WithdrawTransactions extends Model {
  declare id: bigint;
  public address!: string;
  public transferTxHash!: string;
  public status!: string;
  public amount!: string;
  public destinationAddress!: string;
  public approved!: boolean;
}

WithdrawTransactions.init(
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
    transferTxHash: {
      field: 'transfer_tx_hash',
      allowNull: false,
      type: DataTypes.STRING,
      defaultValue: '0',
    },
    amount: {
      field: 'amount',
      allowNull: false,
      type: DataTypes.STRING,
      defaultValue: '0',
    },
    destinationAddress: {
      field: 'destination_address',
      allowNull: false,
      type: DataTypes.STRING,
    },
    approved: {
      field: 'approved',
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: 'withdraw_transactions',
    schema: 'public',
    underscored: true,
  }
);
