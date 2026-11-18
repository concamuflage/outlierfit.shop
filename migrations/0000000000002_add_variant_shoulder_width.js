/**
 * Adds optional garment shoulder width in centimeters to each product variant.
 * For example, SKU 9653 stores 44 for M and 46 for L.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.product_variants
      ADD COLUMN IF NOT EXISTS shoulder_width_cm numeric(5,2)
      CHECK (shoulder_width_cm > 0);

    COMMENT ON COLUMN public.product_variants.shoulder_width_cm IS
      'Garment shoulder seam-to-seam width in centimeters. Example: 44 for SKU 9653 size M.';
  `);
};

// Retain recorded measurements when rolling back application code.
exports.down = false;
