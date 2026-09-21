import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PaymentView = {
  id: string;
  state: string;
  orderId: string;
  total: number;
  usdAmount: string;
  expiresAt: string;
  checkoutUrl: string | null;
  reservationPolicy: string;
};

type Attempt = PaymentView & {
  providerId: string | null;
  createdAt: string;
  updatedAt: string;
  expired: boolean;
};

type AuditEntry = {
  id: string;
  actor_id: string;
  action: "detail" | "close";
  reason: string;
  outcome: string;
  created_at: string;
  completed_at: string | null;
};

type DetailResponse = {
  payment: PaymentView;
  providerId: string | null;
  audit: AuditEntry[];
};

async function operatorRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : response.statusText;
    throw new Error(`HTTP ${response.status}: ${message || "Request failed"}`);
  }
  return body as T;
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function RedotPayRecovery() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState<"detail" | "close" | null>(null);
  const [error, setError] = useState("");
  const [resultNotice, setResultNotice] = useState("");

  const loadAttempts = async (before?: string) => {
    before ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const result = await operatorRequest<{ attempts: Attempt[]; nextCursor: string | null }>(
        `/api/admin/redotpay/attempts${before ? `?before=${encodeURIComponent(before)}` : ""}`,
      );
      setAttempts(current => before ? [...current, ...result.attempts] : result.attempts);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment attempts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setError("");
    setResultNotice("");
    try {
      setDetail(await operatorRequest<DetailResponse>(`/api/admin/redotpay/attempts/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadAttempts();
  }, []);

  const act = async (action: "detail" | "close") => {
    if (!selectedId || !reason.trim()) {
      setError("A reason is required for every operator action.");
      return;
    }
    const prompt = action === "close"
      ? "Request provider closure for this payment? Stock remains reserved unless an authoritative provider detail confirms closure."
      : "Request authoritative payment detail from RedotPay? This action will be recorded in the audit log.";
    if (!window.confirm(prompt)) return;

    setActing(action);
    setError("");
    setResultNotice("");
    try {
      const result = await operatorRequest<{ payment: PaymentView; auditId: string }>(
        `/api/admin/redotpay/attempts/${encodeURIComponent(selectedId)}/reconcile`,
        { method: "POST", body: JSON.stringify({ action, reason: reason.trim() }) },
      );
      setReason("");
      const notice =
        result.payment.state === "closed"
          ? "Provider detail confirmed closure. The payment record is closed."
          : result.payment.state === "paid"
            ? "Provider detail confirmed payment."
            : `Provider detail returned state “${result.payment.state}”. Stock must remain reserved pending authoritative closure or payment.`;
      await Promise.all([loadAttempts(), loadDetail(selectedId)]);
      setResultNotice(notice);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Operator action failed";
      try {
        await loadDetail(selectedId);
      } catch {
        // The original operator-action error is shown below.
      }
      setError(message);
      setResultNotice("The outcome may be uncertain. Do not treat stock as released; review the audit record before taking another action.");
    } finally {
      setActing(null);
    }
  };

  return (
    <section className="mt-8 space-y-4" aria-labelledby="redotpay-recovery-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="redotpay-recovery-title" className="text-xl font-serif">RedotPay recovery</h2>
          <p className="text-sm text-muted-foreground">
            Review unresolved hosted payments. This tool never force-releases reserved stock.
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-none" onClick={() => void loadAttempts()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "mr-2 animate-spin" : "mr-2"} /> Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {resultNotice && (
        <div className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={15} className="mr-2 inline" />{resultNotice}
        </div>
      )}

      <Card className="rounded-none">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading unresolved attempts…</p>
          ) : attempts.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No unresolved RedotPay attempts.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider">
                  <tr><th className="p-3">Attempt</th><th className="p-3">State</th><th className="p-3">Amount</th><th className="p-3">Updated</th><th className="p-3"><span className="sr-only">Open</span></th></tr>
                </thead>
                <tbody>
                  {attempts.map(attempt => (
                    <tr key={attempt.id} className="border-b last:border-0">
                      <td className="p-3"><span className="font-mono text-xs">{attempt.id}</span><br /><span className="text-xs text-muted-foreground">Order {attempt.orderId}</span></td>
                      <td className="p-3"><span className="font-medium">{attempt.state}</span>{attempt.expired && <span className="ml-2 text-xs text-amber-700">expired</span>}</td>
                      <td className="p-3">USD {attempt.usdAmount}</td>
                      <td className="p-3 text-xs text-muted-foreground">{dateTime(attempt.updatedAt)}</td>
                      <td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => void loadDetail(attempt.id)}>Review <ChevronRight size={14} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {nextCursor && (
            <div className="border-t p-3 text-center">
              <Button variant="outline" size="sm" className="rounded-none" disabled={loadingMore} onClick={() => void loadAttempts(nextCursor)}>
                {loadingMore ? "Loading…" : "Load older attempts"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <Card className="rounded-none border-amber-300">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-start justify-between">
              <div><h3 className="font-serif text-lg">Attempt detail</h3><p className="font-mono text-xs">{selectedId}</p></div>
              <Button variant="ghost" size="icon" onClick={() => { setSelectedId(null); setDetail(null); setResultNotice(""); }} aria-label="Close detail"><X size={16} /></Button>
            </div>
            {detailLoading ? <p className="text-sm text-muted-foreground">Loading detail and audit…</p> : detail && (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">State</dt><dd className="font-medium">{detail.payment.state}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Order</dt><dd>{detail.payment.orderId}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Amount</dt><dd>USD {detail.payment.usdAmount}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Provider reference</dt><dd className="break-all font-mono text-xs">{detail.providerId || "Unavailable"}</dd></div>
                </dl>
                <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  A failed, pending, unknown, interrupted, or HTTP-error outcome is not proof of closure. Keep stock reserved.
                </div>
                <div className="space-y-2">
                  <label htmlFor="redotpay-reason" className="text-sm font-medium">Operator reason (required)</label>
                  <Input id="redotpay-reason" className="rounded-none" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this action is needed" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-none" disabled={!!acting || !reason.trim()} onClick={() => void act("detail")}>{acting === "detail" ? "Reconciling…" : "Reconcile provider detail"}</Button>
                    <Button variant="destructive" className="rounded-none" disabled={!!acting || !reason.trim() || ["paid", "closed"].includes(detail.payment.state)} onClick={() => void act("close")}>{acting === "close" ? "Requesting closure…" : "Request provider closure"}</Button>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Operator audit</h4>
                  {detail.audit.length === 0 ? <p className="text-sm text-muted-foreground">No operator actions recorded.</p> : (
                    <div className="space-y-2">
                      {detail.audit.map(entry => (
                        <div key={entry.id} className="border p-3 text-xs">
                          <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{entry.action} · {entry.outcome}</span><span className="text-muted-foreground">{dateTime(entry.created_at)}</span></div>
                          <p className="mt-1">{entry.reason}</p>
                          <p className="mt-1 text-muted-foreground">Actor {entry.actor_id} · Completed {dateTime(entry.completed_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}