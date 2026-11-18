/**
 * Adds optional finished-garment hem circumference in centimeters.
 * For example, SKU Z8038 measures 108 cm in M and 112 cm in L.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.product_variants
      ADD COLUMN IF NOT EXISTS hem_circumference_cm numeric(5,2)
      CHECK (hem_circumference_cm > 0);

    COMMENT ON COLUMN public.product_variants.hem_circumference_cm IS
      'Finished garment hem circumference in centimeters. Example: 108 for SKU Z8038 size M.';
  `);
};

// Preserve recorded measurements during application rollbacks.
exports.down = false;
