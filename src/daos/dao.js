/* eslint-disable default-param-last */
/* eslint-disable prefer-const */
/* eslint-disable one-var */
/* eslint-disable no-promise-executor-return */
/* eslint-disable max-len */
/* eslint-disable quotes */
/**
 * Created by apoorva on 8/23/16.
 */
import { format } from 'util';
import L from '../utils/logger';
import { formatQ, getDbPool } from './mysqldb';

const DaoQ = {
  TIMEOUT: 5000, // 4 minutes, https://github.com/mysqljs/mysql#timeouts
  INSERT: 'INSERT INTO ?? SET ?',
  INSERT_IGNORE: 'INSERT IGNORE INTO ?? SET ?',
  INSERT_MULTIPLE: "INSERT INTO ?? (??) VALUES ?",
  INSERT_OR_UPDATE_MULTIPLE: "INSERT INTO ?? (??) VALUES ? ON DUPLICATE KEY UPDATE",
  INSERT_MULTIPLE_IGNORE: "INSERT IGNORE INTO ?? (??) VALUES ?",
  INSERT_OR_UPDATE: "INSERT INTO ?? SET ? ON DUPLICATE KEY UPDATE ?",
  UPDATE: "UPDATE ?? SET ? WHERE ?? = ?",
  UPDATE_BY_COLUMN_LIST: "UPDATE ?? SET ? WHERE ?? IN (?)",
  UPDATE_CASE_WHEN_THEN: "UPDATE ?? SET ?? = CASE %s ELSE ?? END WHERE ?? IN (?)",
  DELETE: "DELETE FROM ?? WHERE ?? = ?",
  DELETE_BY_COLUMN_LIST: "DELETE FROM ?? WHERE ?? IN (?)",
  GET_ALL_ROWS: "SELECT * FROM ??",
  GET_BY_COLUMN: "SELECT * FROM ?? WHERE ?? = ?",
  COUNT_BY_COLUMN: "SELECT count(*) as count FROM ?? WHERE ?? = ?",
  GET_MAX_ID: "SELECT max(??) as maxId FROM ??",
  GET_MAX_BY_COLUMN: "SELECT max(??) as maxId FROM ?? WHERE ?? = ?",
  GET_PARTIAL_BY_COLUMN: "SELECT ?? FROM ?? WHERE ?? = ?",
  GET_IN_COLUMN_LIST: "SELECT * FROM ?? WHERE ?? IN (?)",
  SELECT_BY_COLUMN_LIST: "SELECT %s FROM ?? WHERE ?? IN (?) %s",
  SELECT_BY_COLUMN_LIST_FOR_UPDATE: "SELECT %s FROM ?? WHERE ?? = ? FOR UPDATE",
  INCREMENT_FIELD_VALUE_BY_ID: "UPDATE ?? SET ?? = ?? + ? WHERE ?? = ?",
  INCREMENT_FIELDS_BY_CONDITIONS: "UPDATE ?? SET %s WHERE %s",
  RANGE_CHECK_ON_INCREMENT: " AND ?? >= ABS(?)",
  GET_PARTIAL_COLUMNS: "SELECT ?? FROM ??",
};

const CLAUSE_ORDER_BY_COLUMN_LIST = "ORDER BY FIELD(??, ?)";

export const SEPARATOR = ' ';

export const SEPARATOR_COLUMN_IN_FIELD_LIST = ', ';

const COND_AND = " AND ?? = ?";

const CLAUSE_WHEN_THEN = 'WHEN ?? = ? THEN ?';

export const DB_READ_LOCK = {
  SHARE: ' FOR SHARE',
  UPDATE: ' FOR UPDATE',
};

export const getStyledLargeNumber = (column) => [
  `CASE WHEN ${column} >= 1000000 THEN CONCAT(ROUND(${column} / 1000000, 1), 'm')`,
  `WHEN ${column} >= 1000 THEN CONCAT(ROUND(${column} / 1000, 1), 'k')`,
  `ELSE ${column} END`,
].join(' ');

export function prefixTable(columns, tablePrefix) {
  return columns.map((col) => `${tablePrefix}.${col}`).join(SEPARATOR_COLUMN_IN_FIELD_LIST);
}

export default class Dao {
  static get Q() { // TODO remove this reference from subclasses, move to const above
    return {
      TIMEOUT: 180000, // 3 minutes, https://github.com/mysqljs/mysql#timeouts
    };
  }

  constructor(tableName) {
    this.tableName = tableName;
  }

  logQuery({ sql_id: sqlId, sql, values = [] }) {
    L.debug({
      message: `SQL_QUERY_LOG: ${sqlId}`,
      sqlId,
      sql_with_values: formatQ(sql, values),
      sql,
      values: JSON.stringify(values),
    });
  }

  getQ({
    db = getDbPool(), sqlId, sql, values, firstResultOnly = false,
  }) {
    this.logQuery({ sql_id: sqlId, sql, values });
    return new Promise((resolve, reject) => {
      db.query(
        { sql, values, timeout: DaoQ.TIMEOUT },
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(firstResultOnly ? rows[0] : rows);
          }
        },
      );
    });
  }

  updateQ({
    db = getDbPool(), sqlId, sql, values,
  }) {
    this.logQuery({ sql_id: sqlId, sql, values });
    return new Promise((resolve, reject) => {
      db.query(
        { sql, values, timeout: DaoQ.TIMEOUT },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  insertObj({
    db = getDbPool(), columnNameValues, tableName = this.tableName, ignore,
  }) {
    const sql = ignore ? DaoQ.INSERT_IGNORE : DaoQ.INSERT;
    const values = [tableName, columnNameValues];

    this.logQuery({ sql_id: `INSERT_OBJ_${tableName}`, sql, values });
    return new Promise((resolve, reject) => db.query(
      { sql, values, timeout: DaoQ.TIMEOUT },
      (err, result, fields) => (err ? reject(err) : resolve(result.insertId)),
    ));
  }

  /**
   * Inserts multiple rows
   * @param db
   * @param columnNames - Array of columns names: ['col1', 'col2'..]
   * @param multiRowsColValuesList - Array of arrays of values in order of columns: [['row1_val1', 'row1_val2'], ['row2_val1', 'row2_val2']..]
   * @param tableName
   * @param ignore
   * @returns {Promise<unknown>}
   */
  insertMultipleObjs({
    db = getDbPool(), columnNames, multiRowsColValuesList, tableName = this.tableName, ignore,
  }) {
    const sql = ignore ? DaoQ.INSERT_MULTIPLE_IGNORE : DaoQ.INSERT_MULTIPLE;
    const values = [tableName, columnNames, multiRowsColValuesList];

    this.logQuery({ sql_id: `INSERT_MULTIPLE_${tableName}`, sql, values });
    return new Promise((resolve, reject) => {
      db.query(
        { sql, values, timeout: DaoQ.TIMEOUT },
        (err, result) => (err ? reject(err) : resolve(result.insertId)),
      );
    });
  }

  insertOrUpdateMultipleObjs({
    db = getDbPool(), columnNames, multiRowsColValuesList, updateColumnNames, tableName = this.tableName,
  }) {
    let sql = DaoQ.INSERT_OR_UPDATE_MULTIPLE,
      values = [tableName, columnNames, multiRowsColValuesList];

    updateColumnNames.forEach((updateCol, index) => {
      sql += ` ?? = VALUES(??)${(index === updateColumnNames.length - 1) ? '' : ' ,'}`;
      values.push(updateCol, updateCol);
    });

    this.logQuery({ sql_id: `INSERT__OR_UPDATE_MULTIPLE_${tableName}`, sql, values });
    return new Promise((resolve, reject) => db.query(
      { sql, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  /**
   * @deprecated use updateIfExistsOrInsert instead
   */
  insertOrUpdate(db = getDbPool(), insertNameValues, updateNameValues, tableName = this.tableName) {
    const sql = DaoQ.INSERT_OR_UPDATE;
    const values = [tableName, insertNameValues, updateNameValues];

    this.logQuery({ sql_id: `INSERT_OR_UPDATE_${tableName}`, sql, values });
    return new Promise((resolve, reject) => {
      db.query(
        { sql, values, timeout: DaoQ.TIMEOUT },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
    });
  }

  // TODO this method to replace insertOrUpdate, makes db optional
  updateIfExistsOrInsert({
    db = getDbPool(), insertNameValues, updateNameValues, tableName = this.tableName,
  }) {
    const
      sql = DaoQ.INSERT_OR_UPDATE,
      values = [tableName, insertNameValues, updateNameValues];

    L.debug("sql = %s, values = %j", sql, values);

    return new Promise((resolve, reject) => {
      db.query(
        { sql: DaoQ.INSERT_OR_UPDATE, values, timeout: DaoQ.TIMEOUT },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
    });
  }

  getAllRows({
    db = getDbPool(), where, orderBy, limit,
  } = {}) {
    let query = DaoQ.GET_ALL_ROWS;
    let values = [this.tableName];

    if (where) query += ` WHERE ${where}`;
    if (orderBy) query += ` ORDER BY ${orderBy}`;
    if (limit) {
      query += " LIMIT ?";
      values.push(limit);
    }
    this.logQuery({ sql_id: `GET_ALL_${this.tableName}`, sql: query, values });
    // L.debug("all values = " + values);
    return new Promise((resolve, reject) => {
      db.query(
        { timeout: DaoQ.TIMEOUT, sql: query, values },
        (err, rows) => (err ? reject(err) : resolve(rows)),
      );
    });
  }

  /**
   * Returns row with all columns IF NO selectColumnList else selectColumnList
   * pagenum starts at 0
   * limit is page size
   * @deprecated use selectByColumns instead of getByColumns
   */
  getByColumns(db = getDbPool(), byColNameValues, firstResultOnly, orderBy, selectColumnList, limit, pagenum) {
    let query = selectColumnList ? DaoQ.GET_PARTIAL_BY_COLUMN : DaoQ.GET_BY_COLUMN;
    const values = [this.tableName];

    let ctr = 0;
    for (const [col_name, value] of Object.entries(byColNameValues)) {
      if (!value) continue;
      values.push(col_name, value);
      if (ctr > 0) {
        query += " AND ?? = ?";
      }
      ctr++;
    }

    if (orderBy) query += ` ORDER BY ${orderBy}`;
    if (selectColumnList) values.unshift(selectColumnList);
    if (pagenum) {
      query += " LIMIT ?,?";
      values.push(pagenum * limit, limit);
    } else if (limit) {
      query += " LIMIT ?";
      values.push(limit);
    }

    this.logQuery({ sql_id: `GET_BY_COLUMNS_${this.tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(firstResultOnly ? rows[0] : rows)),
    ));
  }

  // [Feb 1, 2010 apoorva]: this to replace getByColumns in time
  selectByColumns({
    db = getDbPool(), byColNameValues, firstResultOnly, orderBy, selectColumnList, limit, pagenum,
    tableName = this.tableName, lock,
  }) {
    let query = selectColumnList ? DaoQ.GET_PARTIAL_BY_COLUMN : DaoQ.GET_BY_COLUMN;
    const values = [tableName];

    for (const [col_name, value] of Object.entries(byColNameValues)) {
      if (!value) continue;
      values.push(col_name, value);
      if (values.length > 3) {// for 2nd condition onwards
        query += COND_AND;
      }
    }

    if (lock) { // UPDATE / SHARE
      query += lock;
    }

    if (selectColumnList) values.unshift(selectColumnList);
    if (orderBy) query += ` ORDER BY ${orderBy}`;
    if (pagenum) {
      query += " LIMIT ?,?";
      values.push(pagenum * limit, limit);
    } else if (limit) {
      query += " LIMIT ?";
      values.push(limit);
    }

    this.logQuery({ sql_id: `SELECT_BY_COLUMNS_${tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(firstResultOnly ? rows[0] : rows)),
    ));
  }

  countByColumns(db = getDbPool(), byColNameValues) {
    let query = DaoQ.COUNT_BY_COLUMN,
      byColumns = Object.keys(byColNameValues),
      values = [this.tableName, byColumns[0], byColNameValues[byColumns[0]]];

    if (byColumns.length > 1) { // add other columns in where clause
      for (let i = 1; i < byColumns.length; i += 1) {
        query += " AND ?? = ?";
        values.push(byColumns[i], byColNameValues[byColumns[i]]);
      }
    }
    this.logQuery({ sql_id: `COUNT_BY_COLS_${this.tableName}`, sql: query, values });
    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(rows[0].count)),
    ));
  }

  getMaxId(db = getDbPool(), maxCol) {
    const query = DaoQ.GET_MAX_ID;
    const values = [maxCol, this.tableName];

    this.logQuery({ sql_id: `GET_MAX_ID_${this.tableName}`, sql: query, values });
    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(rows[0].maxId || 0)),
    ));
  }

  getMaxByColumns(db = getDbPool(), maxCol, byColNameValues) {
    let query = DaoQ.GET_MAX_BY_COLUMN,
      byColumns = Object.keys(byColNameValues),
      values = [maxCol, this.tableName, byColumns[0], byColNameValues[byColumns[0]]];

    if (byColumns.length > 1) { // add other columns in where clause
      for (let i = 1; i < byColumns.length; i += 1) {
        query += " AND ?? = ?";
        values.push(byColumns[i], byColNameValues[byColumns[i]]);
      }
    }
    this.logQuery({ sql_id: `GET_MAX_BY_COLS_${this.tableName}`, sql: query, values });
    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(rows[0].maxId || 0)),
    ));
  }

  getById({ db = getDbPool(), id }) {
    if (Number.isNaN(id)) return;
    return this.getByColumns(db, { id }, true);
  }

  /**
   * @deprecated use selectByColumnValues instead
   */
  getInColumnList(db = getDbPool(), col_name, col_values) {
    const sql = DaoQ.GET_IN_COLUMN_LIST;
    const values = [this.tableName, col_name, col_values];
    this.logQuery({ sql_id: `GET_IN_COL_LIST_${this.tableName}`, sql, values });

    return new Promise((resolve, reject) => db.query(
      { sql, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(rows)),
    ));
  }

  // [May 22, 2020] this to replace getInColumnList in time
  selectByColumnValues({
    db = getDbPool(), select_cols, by_col_name = 'id', by_col_values, order_by_values,
  }) {
    const isSelectAll = !select_cols || select_cols === '*';
    const sql = format(
      DaoQ.SELECT_BY_COLUMN_LIST,
      isSelectAll ? '*' : '??',
      order_by_values ? CLAUSE_ORDER_BY_COLUMN_LIST : '',
    );
    const values = [
      select_cols,
      this.tableName,
      by_col_name,
      by_col_values,
      order_by_values ? by_col_name : undefined,
      order_by_values ? by_col_values : undefined,
    ].filter(v => !!v);
    this.logQuery({ sql_id: `SELECT_BY_COLUMN_LIST_${this.tableName}`, sql, values });

    return new Promise((resolve, reject) => db.query(
      { sql, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(rows)),
    ));
  }

  selectByColumnForUpdate({
    db = getDbPool(), select_cols, by_col_name = 'id', by_col_values,
  }) {
    const isSelectAll = !select_cols || select_cols === '*';
    const sql = format(
      DaoQ.SELECT_BY_COLUMN_LIST_FOR_UPDATE,
      isSelectAll ? '*' : '??',
    );
    const values = [
      select_cols,
      this.tableName,
      by_col_name,
      by_col_values,
    ].filter((v) => !!v);
    this.logQuery({ sql_id: `SELECT_BY_COLUMN_LIST_FOR_UPDATE_${this.tableName}`, sql, values });

    return new Promise((resolve, reject) => db.query(
      { sql, values, timeout: DaoQ.TIMEOUT },
      (err, rows) => (err ? reject(err) : resolve(rows)),
    ));
  }

  updateByColumns(db = getDbPool(), columnsNameValues, byColNameValues, tableName = this.tableName) {
    let query = DaoQ.UPDATE,
      byColumns = Object.keys(byColNameValues),
      values = [tableName, columnsNameValues, byColumns[0], byColNameValues[byColumns[0]]];

    if (byColumns.length > 1) { // add other columns in where clause
      for (let i = 1; i < byColumns.length; i += 1) {
        query += " AND ?? = ?";
        values.push(byColumns[i], byColNameValues[byColumns[i]]);
      }
    }

    this.logQuery({ sql_id: `UPDATE_BY_COLUMNS_${tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  updateByColumnList({
    db = getDbPool(), columnsNameValues, by_col_name, by_col_values, tableName = this.tableName,
  }) {
    const query = DaoQ.UPDATE_BY_COLUMN_LIST;
    const values = [tableName, columnsNameValues, by_col_name, by_col_values];

    this.logQuery({ sql_id: `UPDATE_BY_COL_LIST_${this.tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  updateByCase({
    db = getDbPool(), set_col_name, set_col_values, by_col_name, by_col_values, tableName = this.tableName,
  }) {
    const query = format(DaoQ.UPDATE_CASE_WHEN_THEN, by_col_values.map((v) => `${CLAUSE_WHEN_THEN} `).join(SEPARATOR));
    const values = [
      tableName,
      set_col_name,
      ...by_col_values.map((v, i) => [by_col_name, v, set_col_values[i]]).flat(),
      set_col_name,
      by_col_name,
      by_col_values
    ];

    this.logQuery({ sql_id: `UPDATE_CASE_WHEN_THEN_${tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  deleteByColumns(db = getDbPool(), byColNameValues) {
    let query = DaoQ.DELETE,
      byColumns = Object.keys(byColNameValues),
      values = [this.tableName, byColumns[0], byColNameValues[byColumns[0]]];

    if (byColumns.length > 1) { // add other columns in where clause
      for (let i = 1; i < byColumns.length; i += 1) {
        query += " AND ?? = ?";
        values.push(byColumns[i], byColNameValues[byColumns[i]]);
      }
    }

    this.logQuery({ sql_id: `DELETE_BY_COLS_${this.tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  deleteObj({ db = getDbPool(), id }) {
    return this.deleteByColumns(db, { id });
  }

  /**
   * Increments the value or columna_name by increment where byColName = byColValue
   * @param db
   * @param increment
   * @param incrementColNameValue
   * @param byColNameValues
   * @returns {Promise}
   * @deprecated use incrementColsByConditions instead
   */
  addValueByColumn(db = getDbPool(), incrementColNameValue, byColNameValues, tableName = this.tableName) {
    const
      incrementCol = Object.keys(incrementColNameValue)[0],
      incrementValue = incrementColNameValue[incrementCol],
      byColumns = Object.keys(byColNameValues),
      byColName = byColumns[0],
      byColValue = byColNameValues[byColName],
      values = [tableName, incrementCol, incrementCol, incrementValue, byColName, byColValue];

    let query = DaoQ.INCREMENT_FIELD_VALUE_BY_ID;

    if (byColumns.length > 1) {// add other columns in where clause
      for (let i = 1; i < byColumns.length; i += 1) {
        query += " AND ?? = ?";
        values.push(byColumns[i], byColNameValues[byColumns[i]]);
      }
    }

    this.logQuery({ sql_id: `ADD_VALUE_BY_COLS_${tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  // Increments the value of incrementColNameValues {col1: increment1, col2: increment2, ..} where byColName = byColValue, this to replace addValueByColumn in time
  incrementColsByConditions({
    db = getDbPool(), incrementColNameValues, byColNameValues, rangeCheck, tableName = this.tableName,
  }) {
    const values = [tableName];

    let query = DaoQ.INCREMENT_FIELDS_BY_CONDITIONS;

    const nameValues = [];
    for (const [col, value] of Object.entries(incrementColNameValues)) {
      nameValues.push('?? = ?? + ?');
      values.push(col, col, value);
    }
    query = format(query, nameValues.join(', '));

    const byClause = [];
    for (const [col, value] of Object.entries(byColNameValues)) {
      byClause.push("?? = ?");
      values.push(col, value);
    }
    query = format(query, byClause.join(' AND '));

    if (rangeCheck) {// this only works for first column
      query += DaoQ.RANGE_CHECK_ON_INCREMENT;
      const firstCol = Object.keys(incrementColNameValues)[0];
      values.push(firstCol, incrementColNameValues[firstCol]);
    }

    this.logQuery({ sql_id: `INCREMENT_FIELDS_BY_CONDITIONS_${tableName}`, sql: query, values });

    return new Promise((resolve, reject) => db.query(
      { sql: query, values, timeout: DaoQ.TIMEOUT },
      (err, result) => (err ? reject(err) : resolve(result)),
    ));
  }

  selectByColumnWithKeyValuesTypes({
    db = getDbPool(),
    selectColumnList = [],
    byColNameValues = {},
    orderBy,
    pagenum,
    limit,
    lock,
    firstResultOnly,
    tableName = this.tableName,
  }) {
    // Adding column identifier after SELECT clause
    let query = selectColumnList.length > 0 ? DaoQ.GET_PARTIAL_COLUMNS : DaoQ.GET_ALL_ROWS;
    const values = [
      ...(selectColumnList.length > 0 ? [selectColumnList] : []),
      tableName,
    ];

    // Add WHERE predicates based on value types (primitive or list)
    let whereList = []
    for (const [col_name, value] of Object.entries(byColNameValues)) {
      if (!value || (typeof value === 'object' && value.length === 0)) continue;
      values.push(col_name, value);
      whereList.push(typeof value === 'object' ? "?? IN (?)" : "?? = ?");
    }
    if (whereList.length > 0) query = `${query} WHERE ${whereList.join(" AND ")}`;

    // Add ORDER BY based on attribute name
    if (orderBy) query += ` ORDER BY ${orderBy}`;

    // Add pagination, give either (pagenum, pagesize) or just limit)
    if (pagenum) {
      query += " LIMIT ?,?";
      values.push(pagenum * limit, limit);
    } else if (limit) {
      query += " LIMIT ?";
      values.push(limit);
    }

    // Add query lock (UPDATE / SHARE)
    if (lock) query += lock;

    this.logQuery({ sql_id: `SELECT_BY_COLUMNS_${tableName}`, sql: query, values });
    return new Promise((resolve, reject) => db.query({
      sql: query,
      values,
      timeout: DaoQ.TIMEOUT,
    },
    (err, rows) => (err ? reject(err) : resolve(firstResultOnly ? rows[0] : rows)),
    ));
  }
}
