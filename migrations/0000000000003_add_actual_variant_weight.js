/**
 * Adds measured, unpackaged variant weights and preserves precision in order totals.
 * For example, one SKU 9653 shirt weighs 0.05625 kg and displays as 0.06 kg.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.product_variants
      ADD COLUMN IF NOT EXISTS weight_kg numeric(11,5) CHECK (weight_kg > 0);

    COMMENT ON COLUMN public.product_variants.weight_kg IS
      'Actual unpackaged item weight in kilograms. Example: 0.05625 for SKU 9653.';

    ALTER TABLE public.orders
      ALTER COLUMN clothes_weight_kg TYPE numeric(11,5),
      ALTER COLUMN shipping_weight_kg TYPE numeric(11,5);
  `);
};

// Preserve recorded weights and their precision when application code is rolled back.
exports.down = false;
