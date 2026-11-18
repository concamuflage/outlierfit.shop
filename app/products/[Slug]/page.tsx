import type { Metadata } from "next";
import ProductDetailClient from "@/app/products/[Slug]/ProductDetailClient";
import { getProductById } from "@/backend/controllers/productsController";

type ProductPageProps = {
  params: Promise<{ Slug: string }>;
};

type ProductTitlePayload = {
  name?: unknown;
};

const SITE_NAME = "OutlierFit";

function pageTitle(title: string) {
  return `${title} | ${SITE_NAME}`;
}

/** Loads the product title directly, e.g. slug "13" resolves to "Cotton Shirt" without HTTP. */
async function getProductName(slug: string) {
  const productId = Number(slug);
  if (!Number.isFinite(productId)) {
    return null;
  }

  try {
    const response = await getProductById({ params: { id: productId } });
    const product = (await response.json().catch(() => null)) as ProductTitlePayload | null;
    const productName = typeof product?.name === "string" ? product.name.trim() : "";

    return response.ok && productName ? productName : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { Slug } = await params;
  const productName = await getProductName(Slug);

  return {
    title: productName ? pageTitle(productName) : pageTitle("Product"),
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { Slug } = await params;

  return <ProductDetailClient slug={Slug} />;
}
