import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mcems',
  waitForConnections: true,
  connectionLimit: 10,
  // Without this, mysql2 converts DATE/DATETIME/TIMESTAMP columns into JS
  // Date objects at local midnight, which then serialize to UTC in
  // res.json() -- shifting the displayed date back a day for any timezone
  // ahead of UTC (e.g. a DATE of 2026-08-11 was coming out as
  // "2026-08-10T17:00:00.000Z" on a UTC+7 server). Returning plain strings
  // exactly as MySQL stores them avoids that entire class of bug.
  dateStrings: true,
});
