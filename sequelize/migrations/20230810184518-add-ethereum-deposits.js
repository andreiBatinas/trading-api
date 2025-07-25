'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `

      CREATE TABLE public.ethereum_deposit_transactions (
        id bigserial PRIMARY KEY,
        address text not null,
        status text not null,
        deposit_tx_hash text not null,
        transfer_tx_hash text default '0',
        asset_type text not null,
        asset_amount text not null,
        stable_amount text default '0',
        created_at timestamp without time zone default (now() at time zone 'utc'),
        updated_at timestamp without time zone default (now() at time zone 'utc'),

        FOREIGN KEY(address)
            REFERENCES public.user(evm_address)
      );

      `
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      DROP TABLE if exists public.ethereum_deposit_transactions;

      `
    );
  },
};
