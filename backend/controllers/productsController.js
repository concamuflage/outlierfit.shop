const pool = require("../database/pool");

/**
 * Returns a product with variant-specific garment measurements in centimeters.
 * For example, GET /products/13 includes chest_cm: 102 and weight_kg: 0.05625 for size M.
 * Optional hem circumference is included when recorded, e.g. 108 cm for SKU Z8038 size M.
 * Retail price is recorded in USD, e.g. price_usd: 19.9 for SKU Z8038.
 */
exports.getProductById = async (req) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT 
      product_variants.id AS variant_id,
      product_variants.sku,
      product_variants.cost_rmb,
      product_variants.price_usd,
      product_variants.weight_kg,
      product_variants.chest AS garment_chest_cm,
      product_variants.shoulder_width_cm AS garment_shoulder_width_cm,
      product_variants.height AS garment_body_length_cm,
      product_variants.sleeve AS garment_sleeve_length_cm,
      product_variants.hem_circumference_cm AS garment_hem_circumference_cm,
      sizes.size,
      sizes.height_cm,
      sizes.chest_cm,
      products.id AS product_id,
      products.name,
      products.description,
      brands.brand,
      styles.style,
      colors.color,
      inventory.qty,
      product_variant_images.image_link,
      materials.material,
      product_variant_materials.percentage
    FROM product_variants
    JOIN products
      ON products.id = product_variants.product_id
    JOIN brands
      ON brands.id = products.brand_id
    JOIN styles
      ON styles.id = products.style_id
    JOIN colors
      ON colors.id = product_variants.color_id
    JOIN sizes
      ON sizes.id = product_variants.size_id
    LEFT JOIN inventory
      ON inventory.variant_id = product_variants.id
    LEFT JOIN product_variant_images
      ON product_variant_images.product_variant_id = product_variants.id
    LEFT JOIN product_variant_materials
      ON product_variant_materials.product_variant_id = product_variants.id
    LEFT JOIN materials
      ON materials.id = product_variant_materials.material_id
    WHERE products.id = $1`,
    [id]
  );

  if (!result.rows || result.rows.length === 0) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  // Product-level fields (same across all rows)
  const first = result.rows[0];

  const product = {
    product_id: first.product_id,
    name: first.name,
    description: first.description,
    brand: first.brand,
    style: first.style,
    weight_kg:
      first.weight_kg === null || first.weight_kg === undefined ? null : Number(first.weight_kg),
    // Materials are defined at the product level (same across variants)
    materials: [],
    // Variants are color/size specific, used for toggles in the frontend
    variants: [],
  };

  // Consolidate product-level materials (unique by material name)
  const materialsMap = new Map();

  // Consolidate variant-level info (unique by variant_id)
  const variantsMap = new Map();

  for (const row of result.rows) {
    // 1) Materials (product-level)
    if (row.material) {
      const pct = row.percentage === null || row.percentage === undefined ? null : Number(row.percentage);
      if (!materialsMap.has(row.material)) {
        materialsMap.set(row.material, pct);
      }
    }

    // 2) Variants (color/size specific)
    const variantId = row.variant_id;

    if (!variantsMap.has(variantId)) {
      variantsMap.set(variantId, {
        variant_id: variantId,
        sku: row.sku,
        color: row.color,
        size: row.size,
        height_cm: row.height_cm,
        chest_cm: row.chest_cm,
        // Variant measurements describe the finished garment; sizes contains body sizing.
        garment_measurements: {
          chest_cm: row.garment_chest_cm == null ? null : Number(row.garment_chest_cm),
          shoulder_width_cm:
            row.garment_shoulder_width_cm == null ? null : Number(row.garment_shoulder_width_cm),
          body_length_cm:
            row.garment_body_length_cm == null ? null : Number(row.garment_body_length_cm),
          sleeve_length_cm:
            row.garment_sleeve_length_cm == null ? null : Number(row.garment_sleeve_length_cm),
          hem_circumference_cm:
            row.garment_hem_circumference_cm == null ? null : Number(row.garment_hem_circumference_cm),
        },
        cost_rmb: row.cost_rmb === null || row.cost_rmb === undefined ? null : Number(row.cost_rmb),
        price_usd: row.price_usd == null ? null : Number(row.price_usd),
        weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
        qty: row.qty === null || row.qty === undefined ? null : Number(row.qty),
        images: new Set(),
      });
    }

    const v = variantsMap.get(variantId);

    // Add images (unique)
    if (row.image_link) v.images.add(row.image_link);
  }

  product.materials = Array.from(materialsMap.entries()).map(([material, percentage]) => ({
    material,
    percentage,
  }));

  product.variants = Array.from(variantsMap.values()).map((v) => ({
    variant_id: v.variant_id,
    sku: v.sku,
    color: v.color,
    size: v.size,
    height_cm: v.height_cm,
    chest_cm: v.chest_cm,
    garment_measurements: v.garment_measurements,
    cost_rmb: v.cost_rmb,
    price_usd: v.price_usd,
    weight_kg: v.weight_kg,
    qty: v.qty,
    images: Array.from(v.images),
  }));

  return Response.json(product);
};



/** Lists products in a style with stored USD prices, e.g. lowest_price_usd: 19.9. */
exports.getProductsByStyleName = async (req) => {
  try {
    const { styleName } = req.params;

    const result = await pool.query(
      `SELECT 
        products.id AS product_id,
        products.name AS product_name,
        brands.brand,
        product_variants.price_usd,
        colors.color,
        product_variant_images.image_link
      FROM product_variants
      JOIN products
        ON products.id = product_variants.product_id
      JOIN brands
        ON brands.id = products.brand_id
      JOIN styles
        ON styles.id = products.style_id
      JOIN colors
        ON colors.id = product_variants.color_id
      LEFT JOIN product_variant_images
        ON product_variant_images.product_variant_id = product_variants.id
      WHERE styles.style = $1`,
      [styleName]
    );

    // Aggregate rows into one object per product_id
    const productsMap = new Map();

    for (const row of result.rows) {
      const productId = row.product_id;

      if (!productsMap.has(productId)) {
        productsMap.set(productId, {
          product_id: productId,
          name: row.product_name,
          brand: row.brand,
          lowest_price_usd: row.price_usd == null ? null : Number(row.price_usd),
          colors: new Set(),
          photos: new Set(),
        });
      }

      const p = productsMap.get(productId);

      if (row.color) p.colors.add(row.color);
      if (row.image_link) p.photos.add(row.image_link);

      if (row.price_usd != null) {
        const price = Number(row.price_usd);
        if (p.lowest_price_usd === null || price < p.lowest_price_usd) {
          p.lowest_price_usd = price;
        }
      }
    }

    const aggregated = Array.from(productsMap.values()).map((p) => ({
      product_id: p.product_id,
      name: p.name,
      brand: p.brand,
      lowest_price_usd: p.lowest_price_usd,
      colors: Array.from(p.colors),
      photos: Array.from(p.photos),
    }));

    return Response.json(aggregated);
  } catch (err) {
    console.error("getProductsByStyleName error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

/** Lists the catalog using recorded USD prices, e.g. 49.9 for SKU 9653. */
exports.getAllProducts = async () => {
  try {
    const result = await pool.query(
      `SELECT 
        products.id AS product_id,
        products.name AS product_name,
        products.description,
        brands.brand,
        styles.style,
        product_variants.price_usd,
        colors.color,
        product_variant_images.image_link
      FROM product_variants
      JOIN products
        ON products.id = product_variants.product_id
      JOIN brands
        ON brands.id = products.brand_id
      JOIN styles
        ON styles.id = products.style_id
      JOIN colors
        ON colors.id = product_variants.color_id
      LEFT JOIN product_variant_images
        ON product_variant_images.product_variant_id = product_variants.id
      ORDER BY products.id`,
      []
    );

    // Aggregate rows into one object per product_id
    const productsMap = new Map();

    for (const row of result.rows) {
      const productId = row.product_id;

      if (!productsMap.has(productId)) {
        productsMap.set(productId, {
          product_id: productId,
          name: row.product_name,
          description: row.description,
          brand: row.brand,
          style: row.style,
          lowest_price_usd: row.price_usd == null ? null : Number(row.price_usd),
          colors: new Set(),
          photos: new Set(),
        });
      }

      const p = productsMap.get(productId);

      if (row.color) p.colors.add(row.color);
      if (row.image_link) p.photos.add(row.image_link);

      if (row.price_usd != null) {
        const price = Number(row.price_usd);
        if (p.lowest_price_usd === null || price < p.lowest_price_usd) {
          p.lowest_price_usd = price;
        }
      }
    }

    const aggregated = Array.from(productsMap.values()).map((p) => ({
      product_id: p.product_id,
      name: p.name,
      description: p.description,
      brand: p.brand,
      style: p.style,
      lowest_price_usd: p.lowest_price_usd,
      colors: Array.from(p.colors),
      photos: Array.from(p.photos),
    }));

    return Response.json(aggregated);
  } catch (err) {
    console.error("getAllProducts error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
