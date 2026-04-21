import pool from "@/backend/database/pool";

type MeasurementRecord = {
  id: number;
  heightCm: number | null;
  chestCm: number | null;
  sleeveLengthCm: number | null;
};

type AddressRecord = {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  addressType: "shipping" | "billing";
};

type ProfileData = {
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  measurement: MeasurementRecord | null;
  shippingAddresses: AddressRecord[];
  billingAddresses: AddressRecord[];
};

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureProfileTables() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS measurements (
      id SERIAL PRIMARY KEY,
      height_cm NUMERIC(5,2),
      chest_cm NUMERIC(5,2),
      sleeve_length_cm NUMERIC(5,2)
    )`
  );
  await pool.query("ALTER TABLE measurements ALTER COLUMN height_cm DROP NOT NULL");
  await pool.query("ALTER TABLE measurements ALTER COLUMN chest_cm DROP NOT NULL");
  await pool.query("ALTER TABLE measurements ALTER COLUMN sleeve_length_cm DROP NOT NULL");

  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_measurement (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      measurement_id INTEGER NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (user_id, measurement_id)
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      street VARCHAR(255) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(2) NOT NULL,
      zip_code VARCHAR(10) NOT NULL,
      country VARCHAR(50) NOT NULL,
      phone VARCHAR(20) NOT NULL
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_addresses (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      address_type VARCHAR(20) NOT NULL,
      PRIMARY KEY (user_id, address_id)
    )`
  );
}

function mapMeasurement(row: Record<string, unknown>): MeasurementRecord {
  return {
    id: toNumber(row.id),
    heightCm: row.height_cm == null ? null : toNumber(row.height_cm),
    chestCm: row.chest_cm == null ? null : toNumber(row.chest_cm),
    sleeveLengthCm: row.sleeve_length_cm == null ? null : toNumber(row.sleeve_length_cm),
  };
}

function mapAddress(row: Record<string, unknown>): AddressRecord {
  return {
    id: toNumber(row.id),
    name: trimText(row.name),
    street: trimText(row.street),
    city: trimText(row.city),
    state: trimText(row.state),
    zipCode: trimText(row.zip_code),
    country: trimText(row.country),
    phone: trimText(row.phone),
    isDefault: Boolean(row.is_default),
    addressType: trimText(row.address_type) === "billing" ? "billing" : "shipping",
  };
}

export async function getProfile(userId: number): Promise<ProfileData> {
  await ensureProfileTables();

  const userResult = await pool.query(
    `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found.");
  }

  const measurementResult = await pool.query(
    `
      SELECT m.id, m.height_cm, m.chest_cm, m.sleeve_length_cm
      FROM user_measurement um
      JOIN measurements m ON m.id = um.measurement_id
      WHERE um.user_id = $1
      ORDER BY um.is_default DESC, m.id DESC
      LIMIT 1
    `,
    [userId]
  );

  const addressResult = await pool.query(
    `
      SELECT
        a.id,
        a.name,
        a.street,
        a.city,
        a.state,
        a.zip_code,
        a.country,
        a.phone,
        ua.is_default,
        ua.address_type
      FROM user_addresses ua
      JOIN addresses a ON a.id = ua.address_id
      WHERE ua.user_id = $1
      ORDER BY ua.address_type ASC, ua.is_default DESC, a.id ASC
    `,
    [userId]
  );

  const addresses = addressResult.rows.map(mapAddress);

  return {
    user: {
      id: toNumber(userResult.rows[0].id),
      email: trimText(userResult.rows[0].email),
      firstName: userResult.rows[0].first_name ? trimText(userResult.rows[0].first_name) : null,
      lastName: userResult.rows[0].last_name ? trimText(userResult.rows[0].last_name) : null,
    },
    measurement: measurementResult.rows[0] ? mapMeasurement(measurementResult.rows[0]) : null,
    shippingAddresses: addresses.filter((address) => address.addressType === "shipping").slice(0, 2),
    billingAddresses: addresses.filter((address) => address.addressType === "billing"),
  };
}

export async function getUserIdByEmail(email: string) {
  await ensureProfileTables();

  const userResult = await pool.query(
    `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email.trim()]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  return toNumber(userResult.rows[0].id);
}

export async function saveMeasurement(
  userId: number,
  measurement: {
    heightCm: number | null;
    chestCm: number | null;
    sleeveLengthCm: number | null;
  }
) {
  await ensureProfileTables();

  const existingResult = await pool.query(
    `
      SELECT m.id
      FROM user_measurement um
      JOIN measurements m ON m.id = um.measurement_id
      WHERE um.user_id = $1
      ORDER BY um.is_default DESC, m.id DESC
      LIMIT 1
    `,
    [userId]
  );

  if (existingResult.rows[0]?.id) {
    await pool.query(
      `
        UPDATE measurements
        SET height_cm = $2,
            chest_cm = $3,
            sleeve_length_cm = $4
        WHERE id = $1
      `,
      [
        existingResult.rows[0].id,
        measurement.heightCm,
        measurement.chestCm,
        measurement.sleeveLengthCm,
      ]
    );
    return;
  }

  const insertedMeasurement = await pool.query(
    `
      INSERT INTO measurements (height_cm, chest_cm, sleeve_length_cm)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [measurement.heightCm, measurement.chestCm, measurement.sleeveLengthCm]
  );

  await pool.query(
    `
      INSERT INTO user_measurement (user_id, measurement_id, is_default)
      VALUES ($1, $2, TRUE)
    `,
    [userId, insertedMeasurement.rows[0].id]
  );
}

export async function updateAddress(
  userId: number,
  addressId: number,
  address: {
    name: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  }
) {
  await ensureProfileTables();

  const ownershipResult = await pool.query(
    `
      SELECT 1
      FROM user_addresses
      WHERE user_id = $1 AND address_id = $2
      LIMIT 1
    `,
    [userId, addressId]
  );

  if (ownershipResult.rows.length === 0) {
    throw new Error("Address not found.");
  }

  await pool.query(
    `
      UPDATE addresses
      SET name = $2,
          street = $3,
          city = $4,
          state = $5,
          zip_code = $6,
          country = $7,
          phone = $8
      WHERE id = $1
    `,
    [
      addressId,
      address.name,
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country,
      address.phone,
    ]
  );
}

export async function deleteAddress(userId: number, addressId: number) {
  await ensureProfileTables();

  const ownershipResult = await pool.query(
    `
      SELECT is_default, address_type
      FROM user_addresses
      WHERE user_id = $1 AND address_id = $2
      LIMIT 1
    `,
    [userId, addressId]
  );

  if (ownershipResult.rows.length === 0) {
    throw new Error("Address not found.");
  }

  const deletedAddressWasDefault = Boolean(ownershipResult.rows[0].is_default);
  const deletedAddressType = trimText(ownershipResult.rows[0].address_type);

  await pool.query(
    `
      DELETE FROM user_addresses
      WHERE user_id = $1 AND address_id = $2
    `,
    [userId, addressId]
  );

  await pool.query(
    `
      DELETE FROM addresses
      WHERE id = $1
    `,
    [addressId]
  );

  if (deletedAddressWasDefault && deletedAddressType) {
    const replacementResult = await pool.query(
      `
        SELECT address_id
        FROM user_addresses
        WHERE user_id = $1 AND address_type = $2
        ORDER BY address_id ASC
        LIMIT 1
      `,
      [userId, deletedAddressType]
    );

    if (replacementResult.rows.length > 0) {
      await pool.query(
        `
          UPDATE user_addresses
          SET is_default = TRUE
          WHERE user_id = $1
            AND address_type = $2
            AND address_id = $3
        `,
        [userId, deletedAddressType, replacementResult.rows[0].address_id]
      );
    }
  }
}

export async function copyDefaultShippingAddressToBilling(userId: number) {
  await ensureProfileTables();

  const existingBillingResult = await pool.query(
    `
      SELECT 1
      FROM user_addresses
      WHERE user_id = $1 AND address_type = 'billing'
      LIMIT 1
    `,
    [userId]
  );

  if (existingBillingResult.rows.length > 0) {
    throw new Error("Billing address already exists.");
  }

  const shippingResult = await pool.query(
    `
      SELECT
        a.name,
        a.street,
        a.city,
        a.state,
        a.zip_code,
        a.country,
        a.phone
      FROM user_addresses ua
      JOIN addresses a ON a.id = ua.address_id
      WHERE ua.user_id = $1 AND ua.address_type = 'shipping'
      ORDER BY ua.is_default DESC, ua.address_id ASC
      LIMIT 1
    `,
    [userId]
  );

  if (shippingResult.rows.length === 0) {
    throw new Error("Add a shipping address first or enter a separate billing address.");
  }

  const shippingAddress = shippingResult.rows[0];
  await saveAddress(userId, "billing", {
    name: trimText(shippingAddress.name),
    street: trimText(shippingAddress.street),
    city: trimText(shippingAddress.city),
    state: trimText(shippingAddress.state),
    zipCode: trimText(shippingAddress.zip_code),
    country: trimText(shippingAddress.country),
    phone: trimText(shippingAddress.phone),
  });
}

export async function saveAddress(
  userId: number,
  addressType: "shipping" | "billing",
  address: {
    name: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  }
) {
  await ensureProfileTables();

  const existingCount = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM user_addresses
      WHERE user_id = $1 AND address_type = $2
    `,
    [userId, addressType]
  );

  const existingTotal = toNumber(existingCount.rows[0]?.total ?? 0);
  if (addressType === "shipping" && existingTotal >= 2) {
    throw new Error("You can only save up to two shipping addresses.");
  }

  const insertedAddress = await pool.query(
    `
      INSERT INTO addresses (name, street, city, state, zip_code, country, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [
      address.name,
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country,
      address.phone,
    ]
  );

  await pool.query(
    `
      INSERT INTO user_addresses (user_id, address_id, is_default, address_type)
      VALUES ($1, $2, $3, $4)
    `,
    [userId, insertedAddress.rows[0].id, existingTotal === 0, addressType]
  );
}
