'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      CREATE TABLE public.withdraw_transactions (
        id bigserial PRIMARY KEY,
        address text not null,
        status text not null,
        transfer_tx_hash text not null default '0',
        amount text not null,
        destination_address text not null,
        approved boolean default false,
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
      DROP TABLE if exists public.withdraw_transactions;

      `
    );
  },
};
