import type { Cart, Product, ProductVariant } from "./types";

export function money(value?: string | number | null, currency = "IDR"): string {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function productImage(product?: Product): string | null {
  return product?.images?.[0] || product?.meta_thumbnail || product?.variants?.[0]?.images?.[0] || null;
}

export function variantLabel(variant: ProductVariant): string {
  return (
    variant.fullname ||
    [variant.option1_value, variant.option2_value, variant.option3_value]
      .filter(Boolean)
      .join(" / ") ||
    `Variant ${variant.id}`
  );
}

export function cartItemCount(cart?: Cart | null): number {
  if (!cart) return 0;
  if (typeof cart.item_count === "number") return cart.item_count;
  return cart.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
}

export function cartTotal(cart?: Cart | null): string {
  if (!cart) return money(0);
  return money(cart.total || 0);
}

export function nowStamp(): string {
  return new Date().toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function truncate(value: string, length = 140): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}...`;
}
