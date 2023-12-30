import mysql from 'mysql';
import { DB } from '../config';
import L from '../utils/logger';

const CONNECTION_RELEASE_TIMEOUT = 240000; // 4 minutes

const connTrackMap = new Map();

const thePool = mysql.createPool({
  host: DB.HOST,
  port: DB.PORT,
  user: DB.USER,
  password: (DB.PASSWORD) ? DB.PASSWORD : undefined,
  database: DB.NAME,
  connectionLimit: DB.CONNECTION_LIMIT,
  charset: 'utf8mb4',
  // timezone: 'Z' not sure how this is working, keeping time in UTC for now
});

// const connection = mysql.createConnection({
//   host: DB.HOST,
//   port: DB.PORT,
//   user: DB.USER,
//   password: (DB.PASSWORD) ? DB.PASSWORD : undefined,
//   database: DB.NAME,
//   connectionLimit: DB.CONNECTION_LIMIT,
//   charset: 'utf8mb4',
//   // timezone: 'Z' not sure how this is working, keeping time in UTC for now
// });

export const formatQ = mysql.format;

// via socket Path
/*
thePool = mysql.createPool({
  socketPath: DB.SOCKET_PATH,
  user: DB.USER,
  password: DB.PASSWORD,
  database: DB.NAME,
  connectionLimit: DB.CONNECTION_LIMIT,
  charset: 'utf8mb4',
  // timezone: 'Z'//TODO server timezone should be IST
});
*/

export function startMysqlTxn(db) {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) {
        L.error('Txn begin error - ', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function commitMysqlTxn(db) {
  return new Promise((resolve, reject) => {
    db.commit((err) => {
      if (err) {
        L.error('Txn commit error - ', err);
        reject(err);
      }
      resolve();
    });
  });
}

export function rollbackMysqlTxn(db) {
  return new Promise((resolve, reject) => {
    db.rollback((err) => {
      if (err) {
        L.error('Txn rollback error - ', err);
        reject(err);
      } else {
        L.info('Rolled back txn');
        resolve();
      }
    });
  });
}

export function getDbConnectionFromPool({ context } = {}) {
  return new Promise((resolve, reject) => {
    thePool.getConnection((err, connection) => {
      if (err) return reject(err);

      const conn = connection;
      conn.context = context;

      // NOTE: if not attached to req/res this connection needs to be released
      return resolve(conn);
    });
  });
}

export function getDbPool() {
  if (thePool) {
    // L.debug('Acquired from MySQL pool');
    // thePool.query('SELECT 1 AS solution;', (error, results) => {
    //   if (error) throw error;
    //   console.log('The solution is: ', results[0].solution);
    // });
    return thePool;
  }
  L.error('MySQL pool is not initialized');
  throw new Error('MySQL pool is not initialized');
}

export function releaseConnection(conn) {
  if (conn && (typeof conn.release === 'function')) return conn.release();
  return null;
}

function trackPoolConnections(pool, limit) {
  pool.on('acquire', (conn) => {
    // L.debug('Connection acquired. context = %s. --- ', conn.context, conn.threadId);
    connTrackMap.set(conn, setTimeout(() => {
      L.warn('Connection %d acquired past limit!, context = %s, Closing now.', conn.threadId, conn.context);
      releaseConnection(conn);
    }, limit));
  });

  pool.on('release', (conn) => {
    // L.debug('Connection released. context = %s. --- ', conn.context, conn.threadId);
    const connection = conn;
    connection.context = undefined;
    clearTimeout(connTrackMap.get(conn));
    connTrackMap.delete(conn);
  });
}

trackPoolConnections(thePool, CONNECTION_RELEASE_TIMEOUT);

function runDbStatement({ db, query }) {
  return new Promise((resolve, reject) => {
    db.query(query, (error, results) => {
      if (error) reject(error);
      resolve(results);
    });
  });
}

export async function analyzeTables({ db = getDbPool(), tables = [] }) {
  await Promise.all(tables.map(async (table) => {
    const query = `ANALYZE TABLE ${table}`;
    await runDbStatement({ db, query });
  }));
}
