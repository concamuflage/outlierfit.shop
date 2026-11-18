/**
 * Removes international rate tables/selections while retaining monetary order snapshots.
 * For example, an old $22.19 shipping charge stays unchanged after shipping_cost is dropped.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method text NOT NULL DEFAULT 'USPS';
    DO $$ BEGIN
      IF to_regclass('public.shipping_cost') IS NOT NULL THEN
        UPDATE orders o SET shipping_method = concat_ws(' ', sc.mode, sc.delivery_time)
        FROM shipping_cost sc WHERE sc.id = o.shipping_id;
        UPDATE stripe_checkout_sessions s
        SET payload = jsonb_set(s.payload, '{shippingMethod}', to_jsonb(concat_ws(' ', sc.mode, sc.delivery_time)))
        FROM shipping_cost sc WHERE s.payload->>'shippingId' = sc.id::text;
      END IF;
    END $$;
    UPDATE stripe_checkout_sessions SET payload = payload
      - 'shippingId' - 'clothesWeightKg' - 'boxWeightKg' - 'shippingWeightKg';
    ALTER TABLE carts DROP COLUMN IF EXISTS shipping_id;
    ALTER TABLE orders DROP COLUMN IF EXISTS shipping_id,
      DROP COLUMN IF EXISTS clothes_weight_kg,
      DROP COLUMN IF EXISTS box_weight_kg,
      DROP COLUMN IF EXISTS shipping_weight_kg;
    DROP TABLE IF EXISTS shipping_cost;
  `);
};

// Removed international rates require restoring a database backup, not inventing replacement data.
exports.down = false;
