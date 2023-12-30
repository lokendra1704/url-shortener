export const DB = {
  HOST: process.env.MYSQL_DB_HOST || '127.0.0.1',
  PORT: 3306,
  NAME: process.env.MYSQL_DB_NAME || 'demo_db',
  USER: process.env.MYSQL_DB_USER || 'root',
  PASSWORD: process.env.MYSQL_DB_PASSWORD || 'myk064pass',
  CONNECTION_LIMIT: parseInt(process.env.MYSQL_DB_CONNECTION_LIMIT || '10', 10),
};

export const ENV = process.env.ENV || 'DEV';
