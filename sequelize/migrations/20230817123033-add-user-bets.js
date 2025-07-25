'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      CREATE TABLE public.user_bets (
        id bigserial PRIMARY KEY,
        address text not null,
        asset text not null,
        side text not null,
        amount text not null,
        leverage integer not null default 0,
        status text not null,
        entry_price text not null default '0',
        exit_price text not null default '0',
        bust_price text not null default '0',
        pnl double precision default 0,
        fee double precision default 0,
        user_stop_loss_price text,
        user_take_profit_price text,
        upfront_fee double precision,
        asset_type text not null,

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
      DROP TABLE if exists public.user_bets;

      `
    );
  },
};
