import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RedotPayAdmin() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<{ available: boolean; message: string } | null>(null);
  async function request(path: string, body?: unknown) {
    const res = await fetch(`/api/admin/redotpay${path}`, {
      credentials: "same-origin", method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Payment operator request failed");
    return result;
  }
  async function run(id?: string, action?: string, status?: string) {
    setBusy(true); setError("");
    try {
      if (action === "recover") await request("/recover", {});
      else if (id) await request(`/${encodeURIComponent(id)}/action`, { action, status });
      const [payments, readinessResponse] = await Promise.all([
        request(""),
        fetch("/api/payments/redotpay/readiness", { credentials: "same-origin" }),
      ]);
      setData(payments);
      if (readinessResponse.ok) setReadiness(await readinessResponse.json());
      else setReadiness({ available: false, message: "Payment setup status could not be checked." });
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="border p-4 mb-8 space-y-3">
    <h2 className="font-semibold">RedotPay recovery & fulfillment</h2>
    <p className="text-sm text-muted-foreground">Use this panel for RedotPay orders, not the legacy order editor. Unknown payments retain stock. Close requests release it only after provider-confirmed closure. Refunds are not supported here.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => void run()}>Load / refresh payments</Button>
      <Button variant="outline" disabled={busy} onClick={() => void run(undefined, "recover")}>Recover next due payment</Button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {readiness && !readiness.available && <p role="status" className="text-sm text-amber-800">New RedotPay checkout is unavailable: {readiness.message}. Existing payments still require reconciliation.</p>}
    {data?.payments?.length === 0 && <p className="text-sm text-muted-foreground">No RedotPay payments found.</p>}
    {data?.payments?.map((p: any) => <div key={p.id} className="border-t pt-3 space-y-2">
      <p className="break-all"><strong>{p.trackingNumber || p.id}</strong> — {p.state} / {p.orderStatus} — USD {p.usdAmount}</p>
      <p className="text-xs break-all">Payment reference: {p.id}</p>
      <div className="flex flex-wrap gap-2">
        {!["paid", "closed"].includes(p.state) && <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(p.id, "reconcile")}>Reconcile</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => {
            if (window.confirm("Ask RedotPay to close this payment? Stock stays held unless the provider confirms closure.")) void run(p.id, "close");
          }}>Request closure</Button>
        </>}
        {p.state === "paid" && ["processing", "shipped", "out_for_delivery", "delivered"].map(status =>
          <Button key={status} size="sm" variant="outline" disabled={busy || ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"].indexOf(status) <= ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"].indexOf(p.orderStatus)}
            onClick={() => { if (window.confirm(`Set fulfillment to ${status.replaceAll("_", " ")}?`)) void run(p.id, "fulfill", status); }}>{status.replaceAll("_", " ")}</Button>)}
      </div>
    </div>)}
    {data && <details><summary>Recent payment audit events</summary><ul className="text-xs space-y-1 mt-2">
      {data.events.map((e: any, i: number) => <li key={i}>{e.created_at} · {e.payment_id} · {e.actor} · {e.action} · {e.outcome}</li>)}
    </ul></details>}
  </section>;
}