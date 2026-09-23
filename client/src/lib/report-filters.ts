export type ReportSource = "orders" | "pos";

export type ReportFacets = {
  status: string[];
  payment: string[];
  delivery: string[];
  source: ReportSource[];
};

export function matchesReportFacets(
  filters: ReportFacets,
  record: { status: string; payment: string; delivery: string; source: ReportSource },
): boolean {
  return (filters.status.length === 0 || filters.status.includes(record.status)) &&
    (filters.payment.length === 0 || filters.payment.includes(record.payment)) &&
    (filters.delivery.length === 0 || filters.delivery.includes(record.delivery)) &&
    (filters.source.length === 0 || filters.source.includes(record.source));
}