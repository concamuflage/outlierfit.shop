/**
 * Stores retail prices directly in USD, independently of supplier costs in yuan.
 * For example, SKU Z8038 can cost 55 RMB while its price_usd is 19.90.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.product_variants
      ADD COLUMN IF NOT EXISTS price_usd numeric(10,2)
      CHECK (price_usd > 0);

    COMMENT ON COLUMN public.product_variants.price_usd IS
      'Recorded retail price in USD; not calculated from cost_rmb. Example: 19.90 for SKU Z8038.';
  `);
};

// Keep recorded retail prices when rolling back application code.
exports.down = false;
