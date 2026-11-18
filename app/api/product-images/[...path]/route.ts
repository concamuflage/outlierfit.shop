import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import pool from "@/backend/database/pool";

export const runtime = "nodejs";

const storage = new Storage();
const imageTypes: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * Serves a registered catalog photo using server-side Google credentials.
 * For example, /api/product-images/FB7909-010/front.webp reads
 * products/FB7909-010/front.webp from PRODUCT_IMAGES_BUCKET.
 * Storefront visitors can view catalog photos without receiving bucket credentials.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { path } = await params;
  const extension = path.at(-1)?.split(".").at(-1)?.toLowerCase() ?? "";
  const contentType = imageTypes[extension];

  // Restrict paths to raster images. Segments such as '..' and encoded slashes fail.
  if (
    path.length < 2 ||
    path.join("/").length > 1024 ||
    path.some((segment) => !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(segment)) ||
    !Object.hasOwn(imageTypes, extension)
  ) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const bucketName = process.env.PRODUCT_IMAGES_BUCKET;
  if (!bucketName) {
    return NextResponse.json(
      { error: "Product image storage is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const imagePath = `/api/product-images/${path.join("/")}`;
    const registeredImage = await pool.query(
      "SELECT 1 FROM product_variant_images WHERE image_link = $1 LIMIT 1",
      [imagePath]
    );

    // A private bucket may hold other objects. Only database-listed catalog photos are served.
    if (registeredImage.rows.length === 0) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    const [image] = await storage
      .bucket(bucketName)
      .file(`products/${path.join("/")}`)
      .download();

    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(image.byteLength),
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (Number(code) === 404) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    // Authentication errors may contain request headers, so log only the error code.
    console.error("Product image storage read failed", { code });
    return NextResponse.json(
      { error: "Unable to load product image." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
