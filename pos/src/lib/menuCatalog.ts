import type { Product } from "../app/components/Product";
import { products as builtinProducts } from "../app/data/products";

export type CatalogProductRow = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  category: string;
  sizePrices?: Record<string, number> | null;
  sizes?: string[] | null;
  hasExtraToppings?: boolean | null;
  hasSauceOptions?: boolean | null;
  isDeleted?: boolean;
  source?: "builtin" | "custom";
  createdAt?: string;
};

export function normalizeBuiltinProducts(): Product[] {
  return builtinProducts.map((p) =>
    p.category === "Rolls" && p.image === "shawarma.png"
      ? { ...p, category: "Shawarma" }
      : p,
  );
}

export function mergeMenuProducts(
  overrides: CatalogProductRow[],
): CatalogProductRow[] {
  const base = normalizeBuiltinProducts();
  const byId = new Map(overrides.map((p) => [p.id, p]));
  const baseIds = new Set(base.map((p) => p.id));

  const merged: CatalogProductRow[] = [];

  for (const product of base) {
    const override = byId.get(product.id);
    if (override?.isDeleted) continue;

    if (override) {
      merged.push({
        id: product.id,
        name: override.name,
        description: override.description || product.description,
        basePrice: Number(override.basePrice),
        image: override.image || product.image,
        category: override.category || product.category,
        sizePrices:
          override.sizePrices ?? product.sizePrices ?? null,
        sizes: override.sizes ?? product.sizes ?? null,
        hasExtraToppings:
          override.hasExtraToppings ?? product.hasExtraToppings ?? null,
        hasSauceOptions:
          override.hasSauceOptions ?? product.hasSauceOptions ?? null,
        isDeleted: false,
        source: "builtin",
      });
    } else {
      merged.push({
        id: product.id,
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        image: product.image,
        category: product.category,
        sizePrices: product.sizePrices ?? null,
        sizes: product.sizes ?? null,
        hasExtraToppings: product.hasExtraToppings ?? null,
        hasSauceOptions: product.hasSauceOptions ?? null,
        isDeleted: false,
        source: "builtin",
      });
    }
  }

  for (const product of overrides) {
    if (baseIds.has(product.id) || product.isDeleted) continue;
    merged.push({
      ...product,
      basePrice: Number(product.basePrice),
      source: "custom",
    });
  }

  return merged;
}

export function toCartProduct(p: CatalogProductRow): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    basePrice: Number(p.basePrice),
    image: p.image,
    category: p.category,
    ...(p.sizePrices ? { sizePrices: p.sizePrices } : {}),
    ...(p.sizes ? { sizes: p.sizes } : {}),
    ...(p.hasExtraToppings != null
      ? { hasExtraToppings: !!p.hasExtraToppings }
      : {}),
    ...(p.hasSauceOptions != null
      ? { hasSauceOptions: !!p.hasSauceOptions }
      : {}),
  };
}
