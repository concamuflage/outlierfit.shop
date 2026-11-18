import pool from "@/backend/database/pool";

export type PersistedCartItem = {
  id: string;
  name: string;
  price: number;
  weightKg: number | null;
  imageUrl: string | null;
  color: string | null;
  size: string | null;
  qty: number;
};

export type PersistedCart = {
  items: PersistedCartItem[];
  shippingAddressId: number | null;
  billingAddressId: number | null;
};

type SaveCartItem = {
  id: string;
  qty: number;
};

type SaveCartSelection = {
  shippingAddressId?: number | null;
  billingAddressId?: number | null;
};

type CartRow = {
  shipping_address_id: unknown;
  billing_address_id: unknown;
  quantity: unknown;
  variant_id: unknown;
  price_usd: unknown;
  product_id: unknown;
  product_name: unknown;
  color: unknown;
  size: unknown;
  weight_kg: unknown;
  image_link: unknown;
};

type VariantExistenceRow = {
  id: unknown;
};

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function parseVariantId(cartItemId: string) {
  const [, variantIdText] = cartItemId.split("-");
  const variantId = Number(variantIdText);
  return Number.isInteger(variantId) && variantId > 0 ? variantId : null;
}

/** Ensures cart storage with address choices only; no shipping-rate table is required. */
async function ensureCartTables() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS carts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      shipping_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      billing_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS cart_items (
      cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (cart_id, variant_id)
    )`
  );
}

/** Loads recorded USD prices and actual weights, e.g. SKU 9653 is $49.90 and 0.45 kg. */
export async function getCart(userId: number): Promise<PersistedCart> {
  await ensureCartTables();

  const result = await pool.query<CartRow>(
    `
      SELECT
        cts.shipping_address_id,
        cts.billing_address_id,
        ci.quantity,
        pv.id AS variant_id,
        pv.price_usd,
        p.id AS product_id,
        p.name AS product_name,
        c.color,
        s.size,
        pv.weight_kg,
        pvi.image_link
      FROM carts cts
      LEFT JOIN cart_items ci
        ON ci.cart_id = cts.id
      LEFT JOIN product_variants pv
        ON pv.id = ci.variant_id
      LEFT JOIN products p
        ON p.id = pv.product_id
      LEFT JOIN colors c
        ON c.id = pv.color_id
      LEFT JOIN sizes s
        ON s.id = pv.size_id
      LEFT JOIN LATERAL (
        SELECT image_link
        FROM product_variant_images
        WHERE product_variant_id = pv.id
        ORDER BY id ASC
        LIMIT 1
      ) pvi ON true
      WHERE cts.user_id = $1
      ORDER BY ci.created_at ASC NULLS LAST, pv.id ASC NULLS LAST
    `,
    [userId]
  );

  const items = result.rows
    .filter((row: CartRow) => row.variant_id != null)
    .map((row: CartRow) => ({
      id: `${toNumber(row.product_id)}-${toNumber(row.variant_id)}`,
      name: String(row.product_name ?? ""),
      price: row.price_usd == null ? 0 : toNumber(row.price_usd),
      weightKg: row.weight_kg == null ? null : toNumber(row.weight_kg),
      imageUrl: row.image_link ? String(row.image_link) : null,
      color: row.color ? String(row.color) : null,
      size: row.size ? String(row.size) : null,
      qty: toNumber(row.quantity),
    }));

  const metadataRow = result.rows[0];

  return {
    items,
    shippingAddressId: metadataRow?.shipping_address_id == null ? null : toNumber(metadataRow.shipping_address_id),
    billingAddressId: metadataRow?.billing_address_id == null ? null : toNumber(metadataRow.billing_address_id),
  };
}

/** Saves items and address selections, e.g. a US order has no selectable air/sea rate ID. */
export async function saveCart(userId: number, items: SaveCartItem[], selections?: SaveCartSelection) {
  await ensureCartTables();

  const variantItems = items.map((item) => ({
    variantId: parseVariantId(item.id),
    qty: Number(item.qty),
  }));

  if (variantItems.some((item) => item.variantId == null || !Number.isInteger(item.qty) || item.qty <= 0)) {
    throw new Error("Invalid cart items.");
  }

  const variantIds = variantItems
    .map((item) => item.variantId)
    .filter((variantId): variantId is number => variantId != null);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cartResult = await client.query(
      `
        INSERT INTO carts (user_id, shipping_address_id, billing_address_id, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          shipping_address_id = EXCLUDED.shipping_address_id,
          billing_address_id = EXCLUDED.billing_address_id,
          updated_at = NOW()
        RETURNING id
      `,
      [
        userId,
        selections?.shippingAddressId ?? null,
        selections?.billingAddressId ?? null,
      ]
    );

    const cartId = toNumber(cartResult.rows[0].id);

    if (variantIds.length > 0) {
      const existingVariants = await client.query<VariantExistenceRow>(
        `
          SELECT id
          FROM product_variants
          WHERE id = ANY($1::int[])
        `,
        [variantIds]
      );

      const existingVariantIds = new Set(
        existingVariants.rows.map((row: VariantExistenceRow) => toNumber(row.id))
      );
      if (variantIds.some((variantId) => !existingVariantIds.has(variantId))) {
        throw new Error("One or more cart items no longer exist.");
      }
    }

    await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    for (const item of variantItems) {
      await client.query(
        `
          INSERT INTO cart_items (cart_id, variant_id, quantity, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
        `,
        [cartId, item.variantId, item.qty]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
