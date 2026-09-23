export function quotationTotals(items: { quantity: number; unitPrice: number }[], discount = 0) {
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  return { subtotal, total };
}