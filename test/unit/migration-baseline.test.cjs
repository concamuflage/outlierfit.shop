const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { Pool } = require("pg");
const { runner } = require("node-pg-migrate");

/**
 * Applies the baseline to a disposable database and verifies it adds no business data.
 * Example: RUN_MIGRATION_DB_TESTS=1 PGPORT=5433 node --test test/unit/migration-baseline.test.cjs.
 * Existing dev tables are not modified; the temporary database is removed in finally.
 */
test("baseline bootstraps an empty database and is applied only once", {
  skip: process.env.RUN_MIGRATION_DB_TESTS !== "1",
}, async () => {
  const admin = require("../../backend/database/pool");
  const name = "outlierfit_baseline_test_" + Date.now();
  try {
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`);
    const pool = new Pool({
      host: admin.options.host, port: admin.options.port, user: admin.options.user,
      password: admin.options.password, database: name,
    });
    const client = await pool.connect();
    try {
      const options = { dbClient: client, dir: path.resolve(__dirname, "../../migrations"), migrationsTable: "pgmigrations", direction: "up", count: Infinity, log: () => {} };
      await runner(options);
      assert.deepEqual((await client.query("SELECT name FROM public.pgmigrations ORDER BY id")).rows,
        [{ name: "0000000000000_baseline" }]);
      const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'pgmigrations'")).rows;
      assert.equal(tables.length, 22);
      for (const { tablename } of tables) {
        const result = await client.query('SELECT count(*)::int AS count FROM public."' + tablename.replaceAll('"', '""') + '"');
        assert.equal(result.rows[0].count, 0, tablename + " must contain no copied data");
      }
      assert.equal((await client.query("SELECT to_regclass('public.shipping_cost') AS retired")).rows[0].retired, null);
      await runner(options);
      assert.equal((await client.query("SELECT count(*)::int AS count FROM public.pgmigrations")).rows[0].count, 1);
    } finally {
      client.release();
      await pool.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
