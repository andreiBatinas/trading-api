'use strict';

const add = `
CREATE TABLE public.user (
  id bigserial PRIMARY KEY,
  evm_address text UNIQUE,
  evm_private_address text UNIQUE,
  to_supply boolean default false,
  personal_referral_code text,
  referral_code text,
  chat_id text UNIQUE not null,
  balance text not null default '0',

  created_at timestamp without time zone default (now() at time zone 'utc'),
  updated_at timestamp without time zone default (now() at time zone 'utc')
);

`;

const drop = `

DROP TABLE public.user;

`;

async function inTransaction(
  sectionsOrderingQueries,
  Sequelize,
  queryInterface
) {
  return await queryInterface.sequelize.transaction(
    {
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    },
    async (transaction) => {
      const queries = sectionsOrderingQueries.split(';').map((q) => `${q};`);

      for (const q of queries) {
        try {
          await queryInterface.sequelize.query(q, { transaction });
        } catch (error) {
          console.error(error);
          throw error;
        }
      }
    }
  );
}

module.exports = {
  up: async (queryInterface, Sequelize) =>
    await inTransaction(add, Sequelize, queryInterface),
  down: async (queryInterface, Sequelize) =>
    await inTransaction(drop, Sequelize, queryInterface),
};
