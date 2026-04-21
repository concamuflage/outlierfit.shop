import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import pool from "@/backend/database/pool";
import { authOptions } from "@/lib/auth";
import { createInvoiceNumber } from "@/lib/invoice";

type MockPaymentItem = {
  cartItemId: string;
  quantity: number;
  unitPriceUsd: number;
};

type MockPaymentPayload = {
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  clothesWeightKg: number;
  boxWeightKg: number;
  shippingWeightKg: number;
  shippingId: number;
  shippingAddressId: number;
  billingAddressId: number;
  items: MockPaymentItem[];
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function parseVariantId(cartItemId: string) {
  const [, variantIdText] = cartItemId.split("-");
  const variantId = Number(variantIdText);
  return Number.isInteger(variantId) && variantId > 0 ? variantId : null;
}

function isValidPayload(payload: unknown): payload is MockPaymentPayload {
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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as MockPaymentPayload | null;
  if (!isValidPayload(payload)) {
    return badRequest("Invalid mock payment payload.");
  }

  const userId = Number(session.user.id);
  const shippingId = Number(payload.shippingId);
  const shippingAddressId = Number(payload.shippingAddressId);
  const billingAddressId = Number(payload.billingAddressId);

  const variantItems = payload.items.map((item) => ({
    variantId: parseVariantId(item.cartItemId),
    quantity: Number(item.quantity),
    unitPriceUsd: Number(item.unitPriceUsd),
  }));

  if (variantItems.some((item) => item.variantId == null)) {
    return badRequest("Unable to determine one or more cart variant ids.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const addressOwnershipResult = await client.query(
      `
        SELECT address_id
        FROM user_addresses
        WHERE user_id = $1
          AND address_id = ANY($2::int[])
      `,
      [userId, [shippingAddressId, billingAddressId]]
    );

    const ownedAddressIds = new Set(addressOwnershipResult.rows.map((row) => Number(row.address_id)));
    if (!ownedAddressIds.has(shippingAddressId) || !ownedAddressIds.has(billingAddressId)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Selected addresses do not belong to the current user." }, { status: 403 });
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
      await client.query("ROLLBACK");
      return badRequest("Selected shipping option no longer exists.");
    }

    const variantIds = variantItems
      .map((item) => item.variantId)
      .filter((variantId): variantId is number => variantId != null);

    const variantExistenceResult = await client.query(
      `
        SELECT id
        FROM product_variants
        WHERE id = ANY($1::int[])
      `,
      [variantIds]
    );

    const variantIdsInDatabase = new Set(
      variantExistenceResult.rows.map((row) => Number(row.id))
    );

    if (variantIds.some((variantId) => !variantIdsInDatabase.has(variantId))) {
      await client.query("ROLLBACK");
      return badRequest("One or more product variants no longer exist.");
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
          'mock',
          $2,
          NOW(),
          'USD',
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          NOW(),
          NOW()
        )
        RETURNING id, paid_at
      `,
      [
        userId,
        `mock-${Date.now()}`,
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
    const paidAt = new Date(orderInsertResult.rows[0].paid_at).toISOString();
    const invoiceNumber = `${createInvoiceNumber(new Date(paidAt))}-${orderId}`;

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

    await client.query("COMMIT");

    return NextResponse.json({
      orderId,
      invoiceNumber,
      paidAt,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("mock payment order insert error:", error);
    return NextResponse.json({ error: "Unable to save order." }, { status: 500 });
  } finally {
    client.release();
  }
}
