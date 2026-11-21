-- After an ID-preserving catalog import, restore sequence positions without touching orders or users.
-- For example, importing products 13 and 14 makes the next product ID 15 rather than 1.
DO $catalog_sequences$
DECLARE
  catalog_table text;
  sequence_name text;
  largest_id bigint;
BEGIN
  FOR catalog_table IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'id'
      AND table_name = ANY(ARRAY['brands','colors','styles','sizes','materials','products',
        'product_variants','product_variant_images','product_variant_materials','inventory'])
  LOOP
    sequence_name := pg_get_serial_sequence(format('public.%I', catalog_table), 'id');
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('SELECT max(id) FROM public.%I', catalog_table) INTO largest_id;
      PERFORM setval(sequence_name, COALESCE(largest_id, 1), largest_id IS NOT NULL);
    END IF;
  END LOOP;
END;
$catalog_sequences$;
