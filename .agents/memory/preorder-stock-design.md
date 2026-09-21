---
name: Pre-order stock design
description: Reasons behind preorder availability and pricing semantics
---
- `products.preOrderStock`: total campaign cap. null = unlimited, 0 = pre-order sold out (storefront hides pre-order path).
- `products.preOrderVariantStock` jsonb: key `${size}-${color}` → limit. Empty map = all variants allowed. **Non-empty map with a missing key = variant UNAVAILABLE** — this rule must match in server validation, ProductPage, and Checkout.
- Pre-order cart items: `price` = deposit, `preOrderTotalPrice` = full price; order.total = deposits + shipping. Balance due = full value − discount + shipping − order.total.
- Stock deduction is atomic (transaction + SELECT FOR UPDATE, throws if insufficient) and happens BEFORE order creation, with restore on failure; validation aggregates qty across line items per product/variant.
- **Why:** overselling and client/server semantic drift were flagged in review; missing-key = unavailable was chosen because admin editor writes all combos.
- **How to apply:** keep shared backend validation and storefront preorder availability consistent; Vercel now delegates to the shared server, so do not recreate duplicated backend logic.
- `products.preOrderDeadline` text ISO date: pre-order auto-disables when UTC date >= deadline (server rejects, ProductPage/Checkout hide/zero it), regardless of remaining slots. Supabase prod needs: ALTER TABLE products ADD COLUMN IF NOT EXISTS pre_order_deadline text;
