require("dotenv").config();
const Pool = require("pg-pool");
const pg = require("pg");
const { Client } = require("pg");

const pool = new Pool({
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DB,
  password: process.env.DBPASSWORD,
  port: process.env.DBPORT,
  max: 20,
});

module.exports = {
  pool,
};
