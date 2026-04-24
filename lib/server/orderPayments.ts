import pool from "@/backend/database/pool";
import { createInvoiceNumber } from "@/lib/invoice";
import type Stripe from "stripe";

export type CheckoutOrderItem = {
  cartItemId: string;
  quantity: number;
  unitPriceUsd: number;
};

export type CheckoutOrderPayload = {
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  clothesWeightKg: number;
  boxWeightKg: number;
  shippingWeightKg: number;
  shippingId: number;
  shippingAddressId: number;
  billingAddressId: number;
  items: CheckoutOrderItem[];
};

type AddressOwnershipRow = {
  address_id: unknown;
};

type VariantExistenceRow = {
  id: unknown;
};

type ExistingOrderRow = {
  id: unknown;
  invoice_number: unknown;
  paid_at: unknown;
};

type StripeCheckoutSessionRow = {
  stripe_session_id: string;
  user_id: unknown;
  payload: unknown;
  order_id: unknown;
  completed_at: unknown;
};

type StripeWebhookEventRow = {
  id: unknown;
};

type StripePaymentRow = {
  id: unknown;
  order_id: unknown;
  status: unknown;
  paid_at: unknown;
  failed_at: unknown;
};

export type StripeCheckoutOrderStatus =
  | {
      state: "completed";
      orderId: number;
      invoiceNumber: string | null;
      paidAt: string | null;
    }
  | {
      state: "pending";
      paymentStatus: string | null;
      checkoutStatus: string | null;
    }
  | {
      state: "failed";
      paymentStatus: string | null;
      errorMessage: string | null;
    }
  | {
      state: "not_found";
    };

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

export function parseVariantId(cartItemId: string) {
  const [, variantIdText] = cartItemId.split("-");
  const variantId = Number(variantIdText);
  return Number.isInteger(variantId) && variantId > 0 ? variantId : null;
}

export function isValidCheckoutOrderPayload(payload: unknown): payload is CheckoutOrderPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const numericFields = [
    "subtotalUsd",
    "shippingUsd",
    "totalUsd",
    "clothesWeightKg",
    "boxWeightKg",
    "shippingWeightKg",
    "shippingId",
    "shippingAddressId",
    "billingAddressId",
  ];

  if (!numericFields.every((field) => Number.isFinite(toNumber(candidate[field])))) {
    return false;
  }

  if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
    return false;
  }

  return candidate.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const typedItem = item as Record<string, unknown>;
    return (
      typeof typedItem.cartItemId === "string" &&
      typedItem.cartItemId.trim().length > 0 &&
      Number.isInteger(toNumber(typedItem.quantity)) &&
      toNumber(typedItem.quantity) > 0 &&
      Number.isFinite(toNumber(typedItem.unitPriceUsd)) &&
      toNumber(typedItem.unitPriceUsd) >= 0
    );
  });
}

export async function ensureStripeCheckoutSessionTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
      stripe_session_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function ensureStripeWebhookEventsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id BIGSERIAL PRIMARY KEY,
      stripe_event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      stripe_payment_intent_id TEXT,
      stripe_checkout_session_id TEXT,
      order_id BIGINT,
      raw_payload JSONB NOT NULL,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function ensurePaymentsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
      stripe_payment_intent_id TEXT UNIQUE NOT NULL,
      stripe_checkout_session_id TEXT REFERENCES stripe_checkout_sessions(stripe_session_id),
      stripe_customer_id TEXT,
      stripe_charge_id TEXT,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      customer_email TEXT,
      failure_code TEXT,
      failure_message TEXT,
      paid_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

export async function saveStripeCheckoutSession(
  userId: number,
  stripeSessionId: string,
  payload: CheckoutOrderPayload
) {
  await ensureStripeCheckoutSessionTable();
  await pool.query(
    `
      INSERT INTO stripe_checkout_sessions (
        stripe_session_id,
        user_id,
        payload,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, NOW(), NOW())
      ON CONFLICT (stripe_session_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [stripeSessionId, userId, JSON.stringify(payload)]
  );
}

export async function getStripeCheckoutSession(stripeSessionId: string, userId: number) {
  await ensureStripeCheckoutSessionTable();
  const result = await pool.query(
    `
      SELECT stripe_session_id, payload, order_id, completed_at
      FROM stripe_checkout_sessions
      WHERE stripe_session_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [stripeSessionId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as {
    stripe_session_id: string;
    payload: unknown;
    order_id: unknown;
    completed_at: unknown;
  };

  return {
    stripeSessionId: row.stripe_session_id,
    payload: row.payload,
    orderId: row.order_id == null ? null : Number(row.order_id),
    completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)),
  };
}

export async function getStripeCheckoutSessionById(stripeSessionId: string) {
  await ensureStripeCheckoutSessionTable();
  const result = await pool.query<StripeCheckoutSessionRow>(
    `
      SELECT stripe_session_id, user_id, payload, order_id, completed_at
      FROM stripe_checkout_sessions
      WHERE stripe_session_id = $1
      LIMIT 1
    `,
    [stripeSessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    stripeSessionId: row.stripe_session_id,
    userId: row.user_id == null ? null : Number(row.user_id),
    payload: row.payload,
    orderId: row.order_id == null ? null : Number(row.order_id),
    completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)),
  };
}

export async function createStripeWebhookEvent(
  stripeEventId: string,
  eventType: string,
  rawPayload: unknown,
  stripeCheckoutSessionId?: string | null,
  stripePaymentIntentId?: string | null
) {
  await ensureStripeWebhookEventsTable();
  const result = await pool.query<StripeWebhookEventRow>(
    `
      INSERT INTO stripe_webhook_events (
        stripe_event_id,
        event_type,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING id
    `,
    [
      stripeEventId,
      eventType,
      stripePaymentIntentId ?? null,
      stripeCheckoutSessionId ?? null,
      JSON.stringify(rawPayload),
    ]
  );

  if (result.rows.length === 0) {
    return { inserted: false, eventRowId: null };
  }

  return { inserted: true, eventRowId: Number(result.rows[0].id) };
}

export async function markStripeWebhookEventProcessed(
  stripeEventId: string,
  orderId?: number | null
) {
  await ensureStripeWebhookEventsTable();
  await pool.query(
    `
      UPDATE stripe_webhook_events
      SET order_id = COALESCE($2, order_id),
          processed_at = NOW()
      WHERE stripe_event_id = $1
    `,
    [stripeEventId, orderId ?? null]
  );
}

export async function upsertStripePaymentRecord({
  stripePaymentIntentId,
  stripeCheckoutSessionId,
  stripeCustomerId,
  stripeChargeId,
  status,
  amount,
  currency,
  customerEmail,
  failureCode,
  failureMessage,
  paidAt,
  failedAt,
  orderId,
}: {
  stripePaymentIntentId: string;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeChargeId?: string | null;
  status: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
  orderId?: number | null;
}) {
  await ensurePaymentsTable();
  const result = await pool.query<StripePaymentRow>(
    `
      INSERT INTO payments (
        order_id,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        stripe_customer_id,
        stripe_charge_id,
        status,
        amount,
        currency,
        customer_email,
        failure_code,
        failure_message,
        paid_at,
        failed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        NOW(),
        NOW()
      )
      ON CONFLICT (stripe_payment_intent_id)
      DO UPDATE SET
        order_id = COALESCE(EXCLUDED.order_id, payments.order_id),
        stripe_checkout_session_id = COALESCE(EXCLUDED.stripe_checkout_session_id, payments.stripe_checkout_session_id),
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, payments.stripe_customer_id),
        stripe_charge_id = COALESCE(EXCLUDED.stripe_charge_id, payments.stripe_charge_id),
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        customer_email = COALESCE(EXCLUDED.customer_email, payments.customer_email),
        failure_code = EXCLUDED.failure_code,
        failure_message = EXCLUDED.failure_message,
        paid_at = COALESCE(EXCLUDED.paid_at, payments.paid_at),
        failed_at = COALESCE(EXCLUDED.failed_at, payments.failed_at),
        updated_at = NOW()
      RETURNING id, order_id, status, paid_at, failed_at
    `,
    [
      orderId ?? null,
      stripePaymentIntentId,
      stripeCheckoutSessionId ?? null,
      stripeCustomerId ?? null,
      stripeChargeId ?? null,
      status,
      amount,
      currency,
      customerEmail ?? null,
      failureCode ?? null,
      failureMessage ?? null,
      paidAt ?? null,
      failedAt ?? null,
    ]
  );

  const row = result.rows[0];
  return {
    id: Number(row.id),
    orderId: row.order_id == null ? null : Number(row.order_id),
    status: String(row.status),
    paidAt: row.paid_at == null ? null : new Date(String(row.paid_at)),
    failedAt: row.failed_at == null ? null : new Date(String(row.failed_at)),
  };
}

export async function getStripeCheckoutOrderStatus(userId: number, stripeSessionId: string): Promise<StripeCheckoutOrderStatus> {
  await ensureStripeCheckoutSessionTable();
  await ensurePaymentsTable();

  const result = await pool.query(
    `
      SELECT
        COALESCE(scs.order_id, p.order_id, o_ref.id) AS order_id,
        COALESCE(o.invoice_number, o_ref.invoice_number) AS invoice_number,
        COALESCE(o.paid_at, o_ref.paid_at) AS paid_at,
        p.status AS payment_status,
        p.failure_message
      FROM stripe_checkout_sessions scs
      LEFT JOIN payments p ON p.stripe_checkout_session_id = scs.stripe_session_id
      LEFT JOIN orders o ON o.id = COALESCE(scs.order_id, p.order_id)
      LEFT JOIN orders o_ref
        ON o_ref.payment_provider = 'stripe'
       AND o_ref.payment_reference = scs.stripe_session_id
      WHERE scs.stripe_session_id = $1
        AND scs.user_id = $2
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT 1
    `,
    [stripeSessionId, userId]
  );

  if (result.rows.length === 0) {
    return { state: "not_found" };
  }

  const row = result.rows[0] as {
    order_id: unknown;
    invoice_number: unknown;
    paid_at: unknown;
    payment_status: unknown;
    failure_message: unknown;
  };

  if (row.order_id != null) {
    return {
      state: "completed",
      orderId: Number(row.order_id),
      invoiceNumber: row.invoice_number == null ? null : String(row.invoice_number),
      paidAt: row.paid_at == null ? null : new Date(String(row.paid_at)).toISOString(),
    };
  }

  const paymentStatus = row.payment_status == null ? null : String(row.payment_status);
  if (paymentStatus === "failed") {
    return {
      state: "failed",
      paymentStatus,
      errorMessage: row.failure_message == null ? null : String(row.failure_message),
    };
  }

  return {
    state: "pending",
    paymentStatus,
    checkoutStatus: paymentStatus === "paid" ? "complete" : null,
  };
}

function normalizeStripeId(value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.Charge | null): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

export function readStripePaymentIntentId(
  value: string | Stripe.PaymentIntent | null
): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

export function readStripeChargeId(
  latestCharge: string | Stripe.Charge | null | undefined
): string | null {
  return normalizeStripeId(latestCharge ?? null);
}

export function readStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  return normalizeStripeId(customer);
}

export async function finalizePaidOrder({
  userId,
  payload,
  paymentProvider,
  paymentReference,
  paidAt,
}: {
  userId: number;
  payload: CheckoutOrderPayload;
  paymentProvider: string;
  paymentReference: string;
  paidAt: Date;
}) {
  const shippingId = Number(payload.shippingId);
  const shippingAddressId = Number(payload.shippingAddressId);
  const billingAddressId = Number(payload.billingAddressId);
  const variantItems = payload.items.map((item) => ({
    variantId: parseVariantId(item.cartItemId),
    quantity: Number(item.quantity),
    unitPriceUsd: Number(item.unitPriceUsd),
  }));

  if (variantItems.some((item) => item.variantId == null)) {
    throw new Error("Unable to determine one or more cart variant ids.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [paymentReference]);

    const existingOrderResult = await client.query<ExistingOrderRow>(
      `
        SELECT id, invoice_number, paid_at
        FROM orders
        WHERE payment_provider = $1
          AND payment_reference = $2
        LIMIT 1
      `,
      [paymentProvider, paymentReference]
    );

    if (existingOrderResult.rows.length > 0) {
      const existingOrder = existingOrderResult.rows[0];
      await client.query(
        `
          UPDATE stripe_checkout_sessions
          SET order_id = $2,
              completed_at = COALESCE(completed_at, NOW()),
              updated_at = NOW()
          WHERE stripe_session_id = $1
        `,
        [paymentReference, Number(existingOrder.id)]
      );
      await client.query("COMMIT");

      return {
        orderId: Number(existingOrder.id),
        invoiceNumber: String(existingOrder.invoice_number ?? ""),
        paidAt: new Date(String(existingOrder.paid_at)).toISOString(),
      };
    }

    const addressOwnershipResult = await client.query<AddressOwnershipRow>(
      `
        SELECT address_id
        FROM user_addresses
        WHERE user_id = $1
          AND address_id = ANY($2::int[])
      `,
      [userId, [shippingAddressId, billingAddressId]]
    );

    const ownedAddressIds = new Set(
      addressOwnershipResult.rows.map((row: AddressOwnershipRow) => Number(row.address_id))
    );

    if (!ownedAddressIds.has(shippingAddressId) || !ownedAddressIds.has(billingAddressId)) {
      throw new Error("Selected addresses do not belong to the current user.");
    }

    const shippingExistsResult = await client.query(
      `
        SELECT id
        FROM shipping_cost
        WHERE id = $1
        LIMIT 1
      `,
      [shippingId]
    );

    if (shippingExistsResult.rows.length === 0) {
      throw new Error("Selected shipping option no longer exists.");
    }

    const variantIds = variantItems
      .map((item) => item.variantId)
      .filter((variantId): variantId is number => variantId != null);

    const variantExistenceResult = await client.query<VariantExistenceRow>(
      `
        SELECT id
        FROM product_variants
        WHERE id = ANY($1::int[])
      `,
      [variantIds]
    );

    const variantIdsInDatabase = new Set(
      variantExistenceResult.rows.map((row: VariantExistenceRow) => Number(row.id))
    );

    if (variantIds.some((variantId) => !variantIdsInDatabase.has(variantId))) {
      throw new Error("One or more product variants no longer exist.");
    }

    const orderInsertResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          shipment_status,
          payment_status,
          payment_provider,
          payment_reference,
          paid_at,
          currency_code,
          subtotal_usd,
          shipping_usd,
          total_usd,
          clothes_weight_kg,
          box_weight_kg,
          shipping_weight_kg,
          shipping_id,
          shipping_address_id,
          billing_address_id,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'unshipped',
          'paid',
          $2,
          $3,
          $4,
          'USD',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          NOW(),
          NOW()
        )
        RETURNING id, paid_at
      `,
      [
        userId,
        paymentProvider,
        paymentReference,
        paidAt,
        payload.subtotalUsd,
        payload.shippingUsd,
        payload.totalUsd,
        payload.clothesWeightKg,
        payload.boxWeightKg,
        payload.shippingWeightKg,
        shippingId,
        shippingAddressId,
        billingAddressId,
      ]
    );

    const orderId = Number(orderInsertResult.rows[0].id);
    const persistedPaidAt = new Date(orderInsertResult.rows[0].paid_at);
    const invoiceNumber = `${createInvoiceNumber(persistedPaidAt)}-${orderId}`;

    await client.query(
      `
        UPDATE orders
        SET invoice_number = $2,
            invoice_generated_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [orderId, invoiceNumber]
    );

    for (const item of variantItems) {
      await client.query(
        `
          INSERT INTO orders_variants (order_id, variant_id, quantity, snapshot_price)
          VALUES ($1, $2, $3, $4)
        `,
        [orderId, item.variantId, item.quantity, item.unitPriceUsd]
      );
    }

    await client.query(
      `
        DELETE FROM cart_items
        WHERE cart_id IN (
          SELECT id
          FROM carts
          WHERE user_id = $1
        )
      `,
      [userId]
    );

    await client.query(
      `
        UPDATE carts
        SET shipping_address_id = NULL,
            billing_address_id = NULL,
            shipping_id = NULL,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      [userId]
    );

    await client.query(
      `
        UPDATE stripe_checkout_sessions
        SET order_id = $2,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE stripe_session_id = $1
      `,
      [paymentReference, orderId]
    );

    await client.query("COMMIT");

    return {
      orderId,
      invoiceNumber,
      paidAt: persistedPaidAt.toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
