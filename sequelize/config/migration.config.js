require('dotenv').config();
var pg = require('pg');

const sslConfig = process.env.SSL === 'false' ? false : true;
if (!sslConfig) {
}

pg.defaults.ssl = true;

const dbUser = '1';
const dbPassword = '1';
const dbHost = '1';
const dbPort = '1';
const dbDatabase = '1';

module.exports = {
  development: {
    username: dbUser,
    password: dbPassword,
    database: dbDatabase,
    host: dbHost,
    dialect: 'postgres',
    port: dbPort,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
