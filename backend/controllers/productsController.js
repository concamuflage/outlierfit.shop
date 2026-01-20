const pool = require("../database/pool");

exports.getProductById = async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT 
    product_variants.sku,
    sizes.size,
    sizes.height_cm,
    sizes.chest_cm,
    products.description,
    products.id,
    products.name,
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
    WHERE product_variants.id = $1`,
    [id]
  );

  res.json(result.rows[0]);
};