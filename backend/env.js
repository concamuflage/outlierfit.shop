const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

/** Reads the one root env file for standalone server tools, e.g. PGHOST from .env.local. */
function readSettings() {
  const filename = path.resolve(process.cwd(), ".env.local");
  return fs.existsSync(filename) ? dotenv.parse(fs.readFileSync(filename)) : {};
}

const localSettings = readSettings();

/** Resolves server settings from the process or root .env.local, e.g. RESEND_API_KEY. */
function getServerEnv(key) {
  return process.env[key] ?? localSettings[key];
}

module.exports = { getServerEnv };
