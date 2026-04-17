const bcrypt = require("bcryptjs");
const pool = require("../database/pool");
const MIN_PASSWORD_LENGTH = 12;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isStrongPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return false;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasLower && hasUpper && hasDigit;
}

const ensureUsersTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT");
};

exports.signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedFirstName = typeof firstName === "string" ? firstName.trim() : "";
    const normalizedLastName = typeof lastName === "string" ? lastName.trim() : "";

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Email, password, first name, and last name are required" });
    }

    if (!normalizedEmail) {
      return res.status(400).json({ error: "A valid email is required." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 12 characters and include uppercase, lowercase, and a number.",
      });
    }

    await ensureUsersTable();

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Unable to create account." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name",
      [normalizedEmail, passwordHash, normalizedFirstName, normalizedLastName]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    await ensureUsersTable();

    const result = await pool.query(
      "SELECT id, email, first_name, last_name, password_hash FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
