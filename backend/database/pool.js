const { Pool } = require("pg");
const { getServerEnv: resolveEnvValue } = require("../env");

const host = resolveEnvValue("PGHOST");
const port = Number(resolveEnvValue("PGPORT") || 5432);
const user = resolveEnvValue("PGUSER");
const password = resolveEnvValue("PGPASSWORD");
const database = resolveEnvValue("PGDATABASE");

if (!host || !user || !password || !database) {
  throw new Error("Missing PostgreSQL configuration. Expected PGHOST, PGUSER, PGPASSWORD, and PGDATABASE.");
}

// Next hot reloads modules; reuse connections instead of allocating another pool each time.
const pool = globalThis.outlierfitPool ?? new Pool({
  host,
  port,
  user,
  password,
  database,
});

if (process.env.NODE_ENV !== "production") globalThis.outlierfitPool = pool;

module.exports = pool;
