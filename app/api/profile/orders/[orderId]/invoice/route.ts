import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import pool from "@/backend/database/pool";
import { authOptions } from "@/lib/auth";
import { formatShippingMode } from "@/lib/shipping";

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId =
    typeof session?.user?.id === "string" && session.user.id.trim()
      ? Number(session.user.id)
      : null;

  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId: orderIdText } = await context.params;
  const orderId = Number(orderIdText);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  try {
    const orderResult = await pool.query(
      `
        SELECT
          o.id,
          o.invoice_number,
          o.subtotal_usd,
          o.shipping_usd,
          o.total_usd,
          o.paid_at,
          u.email AS customer_email,
          sc.mode AS shipping_mode,
          sc.delivery_time AS shipping_delivery_time,
          sa.name AS shipping_name,
          sa.street AS shipping_street,
          sa.city AS shipping_city,
          sa.state AS shipping_state,
          sa.zip_code AS shipping_zip_code,
          sa.country AS shipping_country,
          sa.phone AS shipping_phone,
          ba.name AS billing_name,
          ba.street AS billing_street,
          ba.city AS billing_city,
          ba.state AS billing_state,
          ba.zip_code AS billing_zip_code,
          ba.country AS billing_country,
          ba.phone AS billing_phone
        FROM orders o
        JOIN users u
          ON u.id = o.user_id
        JOIN shipping_cost sc
          ON sc.id = o.shipping_id
        JOIN addresses sa
          ON sa.id = o.shipping_address_id
        JOIN addresses ba
          ON ba.id = o.billing_address_id
        WHERE o.id = $1
          AND o.user_id = $2
        LIMIT 1
      `,
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const row = orderResult.rows[0];

    const itemsResult = await pool.query(
      `
        SELECT
          ov.quantity,
          ov.snapshot_price,
          p.name AS product_name,
          c.color,
          s.size
        FROM orders_variants ov
        JOIN product_variants pv
          ON pv.id = ov.variant_id
        JOIN products p
          ON p.id = pv.product_id
        JOIN colors c
          ON c.id = pv.color_id
        LEFT JOIN sizes s
          ON s.id = pv.size_id
        WHERE ov.order_id = $1
        ORDER BY ov.id ASC
      `,
      [orderId]
    );

    return NextResponse.json({
      invoiceNumber: String(row.invoice_number ?? ""),
      paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
      customerEmail: row.customer_email ? String(row.customer_email) : null,
      shippingModeLabel: `${formatShippingMode(String(row.shipping_mode ?? ""))}${row.shipping_delivery_time ? ` ${String(row.shipping_delivery_time)}` : ""}`,
      subtotalUsd: toNumber(row.subtotal_usd),
      shippingUsd: toNumber(row.shipping_usd),
      totalUsd: toNumber(row.total_usd),
      items: itemsResult.rows.map((itemRow) => ({
        name: String(itemRow.product_name ?? ""),
        quantity: toNumber(itemRow.quantity),
        unitPriceUsd: toNumber(itemRow.snapshot_price),
        color: itemRow.color ? String(itemRow.color) : null,
        size: itemRow.size ? String(itemRow.size) : null,
      })),
      shippingAddress: {
        name: String(row.shipping_name ?? ""),
        street: String(row.shipping_street ?? ""),
        city: String(row.shipping_city ?? ""),
        state: String(row.shipping_state ?? ""),
        zipCode: String(row.shipping_zip_code ?? ""),
        country: String(row.shipping_country ?? ""),
        phone: String(row.shipping_phone ?? ""),
      },
      billingAddress: {
        name: String(row.billing_name ?? ""),
        street: String(row.billing_street ?? ""),
        city: String(row.billing_city ?? ""),
        state: String(row.billing_state ?? ""),
        zipCode: String(row.billing_zip_code ?? ""),
        country: String(row.billing_country ?? ""),
        phone: String(row.billing_phone ?? ""),
      },
    });
  } catch (error) {
    console.error("get invoice payload for order error:", error);
    return NextResponse.json({ error: "Unable to load invoice payload." }, { status: 500 });
  }
}
