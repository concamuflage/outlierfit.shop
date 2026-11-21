const fs = require("node:fs");
const path = require("node:path");

/**
 * Creates the current schema in an empty database, without catalog or customer rows.
 * For example, a new staging database receives inventory.qty and the flat domestic shipping columns.
 * Existing matching databases must mark this migration applied, rather than recreating their tables.
 */
exports.up = (pgm) => {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema", "baseline.sql"), "utf8");
  pgm.sql(schema);
  // pg_dump clears search_path; restore it so subsequent migrations can reference public tables.
  pgm.sql("SET search_path TO public;");
};

// Rolling back a baseline would destroy the application schema and its data.
exports.down = false;
