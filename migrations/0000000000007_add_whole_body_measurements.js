/**
 * Adds optional whole-body measurements without changing saved torso lengths.
 * For example, a 150 lb, 68 inch person can store weight_lb: 150 and body_height_cm: 172.7.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.measurements
      ADD COLUMN IF NOT EXISTS weight_lb numeric(7,2) CHECK (weight_lb > 0),
      ADD COLUMN IF NOT EXISTS body_height_cm numeric(5,1) CHECK (body_height_cm > 0);

    COMMENT ON COLUMN public.measurements.weight_lb IS
      'Optional body weight in pounds. Example: 150.00 lb.';
    COMMENT ON COLUMN public.measurements.body_height_cm IS
      'Optional standing full-body height in centimeters, separate from upper body length. Example: 172.7 cm for 68 inches.';
  `);
};

// Retain recorded body measurements when rolling back application code.
exports.down = false;
