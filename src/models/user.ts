import { DataTypes, Model } from 'sequelize';

import { sequelize } from '../db';

export class User extends Model {
  declare id: bigint;
  public evmAddress!: string;
  public evmPrivateAddress!: string;
  public toSupply!: boolean;
  public personalReferralCode!: string;
  public referralCode!: string;
  public chatId!: string;
  public balance!: string;
}

User.init(
  {
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    evmAddress: {
      field: 'evm_address',
      allowNull: false,
      type: DataTypes.STRING,
      unique: true,
    },
    evmPrivateAddress: {
      field: 'evm_private_address',
      allowNull: false,
      type: DataTypes.STRING,
      unique: true,
    },
    toSupply: {
      field: 'to_supply',
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    personalReferralCode: {
      field: 'personal_referral_code',
      allowNull: true,
      type: DataTypes.STRING,
    },
    referralCode: {
      field: 'referral_code',
      allowNull: true,
      type: DataTypes.STRING,
    },
    chatId: {
      field: 'chat_id',
      allowNull: true,
      type: DataTypes.STRING,
    },
    balance: {
      field: 'balance',
      allowNull: false,
      type: DataTypes.STRING,
      defaultValue: '0',
    },
  },
  {
    sequelize,
    tableName: 'user',
    schema: 'public',
    underscored: true,
  }
);
