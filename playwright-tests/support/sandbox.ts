import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { hash } from "bcryptjs";
import Stripe from "stripe";
import { assertSafeTarget, assertTestStripeKey, envValue, generateGmailAlias, requiredEnvValue } from "./testEnv";

export type Account = { id: number; email: string; password: string };
export type Product = { id: number; variantId: number; cartItemId: string; name: string; price: number; color: string; size: string };
export const password = "StrongPass123A";

/** Owns one test's DB fixtures; e.g. a paid test order can only consume its private 20-unit variant. */
export class Sandbox {
  readonly emails = new Set<string>();
  readonly users = new Set<number>();
  readonly products = new Set<number>();
  readonly addresses = new Set<number>();
  readonly startedAt = Date.now();

  /** Accepts an already connected, non-production client; callers must use open() for safety checks. */
  private constructor(readonly db: Client) {}

  /** Checks both app URL and actual DB name before writes, e.g. outlierfit_production is rejected. */
  static async open(baseURL: string) {
    assertSafeTarget(baseURL);
    const connectionString = envValue("TEST_DATABASE_URL") || envValue("DATABASE_URL");
    const db = new Client(connectionString ? { connectionString } : {
      host: requiredEnvValue("PGHOST"), port: Number(envValue("PGPORT", "5433")),
      database: requiredEnvValue("PGDATABASE"), user: requiredEnvValue("PGUSER"),
      password: requiredEnvValue("PGPASSWORD"), connectionTimeoutMillis: 10000,
    });
    await db.connect();
    const { rows } = await db.query("SELECT current_database() AS name, inet_server_addr()::text AS host");
    if (/prod/i.test(rows[0].name) || rows[0].host === "34.30.130.197" || rows[0].host === "10.20.0.5") {
      await db.end();
      throw new Error("Production database fixtures are forbidden.");
    }
    return new Sandbox(db);
  }

  /** Records ownership before signup, so a failed assertion still cleans name+pw<UUID>@gmail.com. */
  email(mail = false) {
    const email = mail ? generateGmailAlias() : `pw-${randomUUID()}@example.invalid`;
    this.emails.add(email);
    return email;
  }

  /** Seeds a unique verified account instead of changing the configured shared user's cart or addresses. */
  async account(mail = false): Promise<Account> {
    const email = this.email(mail);
    const { rows } = await this.db.query(
      "INSERT INTO users(email,password_hash,first_name,last_name,email_verified) VALUES($1,$2,'PW','Tester',true) RETURNING id",
      [email, await hash(password, 10)],
    );
    this.users.add(rows[0].id);
    return { id: rows[0].id, email, password };
  }

  /** Creates an isolated product using existing taxonomy, e.g. one $34.99 Shirts variant with stock 20. */
  async product(style = "Shirts", price = 34.99): Promise<Product> {
    const template = (await this.db.query(
      `SELECT pv.id AS source_variant_id,pv.color_id,pv.size_id,p.brand_id,p.style_id,c.color,s.size FROM product_variants pv
       JOIN products p ON p.id=pv.product_id JOIN styles st ON st.id=p.style_id
       JOIN colors c ON c.id=pv.color_id JOIN sizes s ON s.id=pv.size_id WHERE st.style=$1 LIMIT 1`, [style],
    )).rows[0];
    if (!template) throw new Error(`Catalog prerequisite missing: ${style}`);
    const name = `PW ${style} ${randomUUID().slice(0, 8)}`;
    const id = (await this.db.query(
      "INSERT INTO products(name,brand_id,style_id) VALUES($1,$2,$3) RETURNING id",
      [name, template.brand_id, template.style_id],
    )).rows[0].id;
    this.products.add(id);
    const variantId = (await this.db.query(
      `INSERT INTO product_variants(product_id,color_id,size_id,sku,sleeve,height,chest,shoulder_width_cm,weight_kg,price_usd)
       VALUES($1,$2,$3,$4,62,72,106,46,0.45,$5) RETURNING id`,
      [id, template.color_id, template.size_id, `pw-${randomUUID()}`, price],
    )).rows[0].id;
    await this.db.query("INSERT INTO inventory(variant_id,qty) VALUES($1,20)", [variantId]);
    await this.db.query(`INSERT INTO product_variant_images(product_variant_id,image_link)
      SELECT $1,image_link FROM product_variant_images WHERE product_variant_id=$2 ORDER BY id LIMIT 1`,
      [variantId, template.source_variant_id]);
    return { id, variantId, cartItemId: `${id}-${variantId}`, name, price, color: template.color, size: template.size };
  }

  /** Seeds an owned address, e.g. Shipping One at 123 Test Street, without borrowing a customer's data. */
  async address(account: Account, type: "shipping" | "billing", name: string, isDefault = false) {
    const id = (await this.db.query(
      `INSERT INTO addresses(name,street,city,state,zip_code,country,phone)
       VALUES($1,'123 Test Street','Boston','MA','02135','United States','+1 2015550123') RETURNING id`, [name],
    )).rows[0].id;
    this.addresses.add(id);
    await this.db.query("INSERT INTO user_addresses(user_id,address_id,address_type,is_default) VALUES($1,$2,$3,$4)",
      [account.id, id, type, isDefault]);
    return id as number;
  }

  /** Seeds the same paid/unshipped order snapshot the Java API fixtures use, without submitting a payment. */
  async order(account: Account, product: Product, shipping: number, billing: number) {
    const invoiceNumber = `PW-${randomUUID()}`;
    const id = (await this.db.query(
      `INSERT INTO orders(user_id,shipment_status,payment_status,payment_provider,payment_reference,paid_at,
       subtotal_usd,shipping_usd,total_usd,shipping_method,invoice_number,shipping_address_id,billing_address_id)
       VALUES($1,'unshipped','paid','playwright',$2,NOW(),$3,8.95,$4,'USPS',$5,$6,$7) RETURNING id`,
      [account.id, `pw-${randomUUID()}`, product.price * 2, product.price * 2 + 8.95, invoiceNumber, shipping, billing],
    )).rows[0].id;
    await this.db.query("INSERT INTO orders_variants(order_id,variant_id,quantity,snapshot_price) VALUES($1,$2,2,$3)",
      [id, product.variantId, product.price]);
    return { id: Number(id), invoiceNumber };
  }

  /** Removes only this test's users, orders, sessions, addresses, and private catalog rows after pass or failure. */
  async cleanup() {
    let inTransaction = false;
    let stripeError: unknown;
    try {
      const found = await this.db.query("SELECT id FROM users WHERE email=ANY($1::text[])", [[...this.emails]]);
      for (const row of found.rows) this.users.add(row.id);
      const ids = [...this.users];
      // Expire only owned, still-open sandbox sessions, including failures before the payment form was submitted.
      const sessions = (await this.db.query("SELECT stripe_session_id FROM stripe_checkout_sessions WHERE user_id=ANY($1::int[])", [ids])).rows;
      try {
        if (sessions.length) {
          const stripe = new Stripe(assertTestStripeKey(requiredEnvValue("STRIPE_SECRET_KEY")), { timeout: 20000, maxNetworkRetries: 0 });
          for (const row of sessions) {
            if (!row.stripe_session_id.startsWith("cs_test_")) throw new Error("Refusing to clean a live Stripe session.");
            const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
            if (session.livemode || !ids.includes(Number(session.client_reference_id))) throw new Error("Stripe fixture owner/mode mismatch.");
            if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
          }
        }
      } catch (error) {
        // Provider outages must still allow owned local DB rows to be removed; surface the failure afterward.
        stripeError = error;
      }
      await this.db.query("BEGIN");
      inTransaction = true;
      const addresses = await this.db.query("SELECT address_id FROM user_addresses WHERE user_id=ANY($1::int[])", [ids]);
      for (const row of addresses.rows) this.addresses.add(row.address_id);
      const measurements = (await this.db.query("SELECT measurement_id FROM user_measurement WHERE user_id=ANY($1::int[])", [ids])).rows.map(r => r.measurement_id);
      await this.db.query(`DELETE FROM stripe_webhook_events WHERE order_id IN (SELECT id FROM orders WHERE user_id=ANY($1::int[]))
        OR stripe_checkout_session_id IN (SELECT stripe_session_id FROM stripe_checkout_sessions WHERE user_id=ANY($1::int[]))`, [ids]);
      await this.db.query(`DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id=ANY($1::int[]))
        OR stripe_checkout_session_id IN (SELECT stripe_session_id FROM stripe_checkout_sessions WHERE user_id=ANY($1::int[]))`, [ids]);
      await this.db.query("DELETE FROM stripe_checkout_sessions WHERE user_id=ANY($1::int[])", [ids]);
      await this.db.query("DELETE FROM orders WHERE user_id=ANY($1::int[])", [ids]);
      await this.db.query("DELETE FROM users WHERE id=ANY($1::int[])", [ids]);
      await this.db.query("DELETE FROM measurements WHERE id=ANY($1::int[]) AND NOT EXISTS(SELECT 1 FROM user_measurement WHERE measurement_id=measurements.id)", [measurements]);
      await this.db.query("DELETE FROM addresses WHERE id=ANY($1::int[]) AND NOT EXISTS(SELECT 1 FROM user_addresses WHERE address_id=addresses.id)", [[...this.addresses]]);
      await this.db.query("DELETE FROM products WHERE id=ANY($1::int[])", [[...this.products]]);
      await this.db.query("COMMIT");
      inTransaction = false;
      if (stripeError) throw new Error("Database fixtures removed, but Stripe test-session expiration failed.", { cause: stripeError });
    } catch (error) {
      if (inTransaction) await this.db.query("ROLLBACK");
      throw error;
    } finally {
      await this.db.end();
    }
  }
}
