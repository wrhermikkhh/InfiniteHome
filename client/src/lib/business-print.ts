export type PrintDocumentData = {
  kind: "quotation" | "invoice" | "balance_invoice" | "delivery_note";
  number: string;
  date: string;
  dueDate?: string;
  partyName: string;
  contactLines?: string[];
  reference?: string;
  referenceLabel?: string;
  notes?: string;
  items: { description: string; quantity: number; unitPrice?: number }[];
  summaryRows?: { label: string; value: number }[];
  paymentRows?: { label: string; value: number }[];
  total?: number;
  totalLabel?: string;
  closingText?: string;
  signature?: boolean;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"'`]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
  })[character] || character);

const safeNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const money = (value: unknown): string =>
  `${safeNumber(value) < 0 ? "−" : ""}MVR ${Math.abs(safeNumber(value)).toLocaleString("en-MV", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const labels: Record<PrintDocumentData["kind"], string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  balance_invoice: "Balance Invoice",
  delivery_note: "Delivery Note",
};

const dateLabel = (value?: string): string => value || "—";

export function renderBusinessDocument(data: PrintDocumentData): string {
  const isDeliveryNote = data.kind === "delivery_note";
  const title = labels[data.kind];
  const contactLines = (data.contactLines || []).filter(Boolean);
  const rows = data.items.map((item) => {
    const quantity = safeNumber(item.quantity);
    const lineTotal = quantity * safeNumber(item.unitPrice);
    return `<tr>
      <td class="description">${escapeHtml(item.description)}</td>
      <td class="quantity">${escapeHtml(quantity)}</td>
      ${isDeliveryNote ? "" : `<td class="amount">${escapeHtml(money(item.unitPrice))}</td><td class="amount">${escapeHtml(money(lineTotal))}</td>`}
    </tr>`;
  }).join("");

  const summary = !isDeliveryNote && data.summaryRows?.length
    ? data.summaryRows.map((row) => `<div class="summary-row"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(money(row.value))}</strong></div>`).join("")
    : "";
  const total = !isDeliveryNote && data.total !== undefined
    ? `<div class="summary-total"><span>${escapeHtml(data.totalLabel || "Total")}</span><strong>${escapeHtml(money(data.total))}</strong></div>`
    : "";
  const payment = !isDeliveryNote && data.paymentRows?.length
    ? `<div class="payment-details">${data.paymentRows.map(row => `<div class="summary-row"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(money(row.value))}</strong></div>`).join("")}</div>`
    : "";
  const details = [
    `<div><span class="meta-label">Document no.</span><strong>${escapeHtml(data.number)}</strong></div>`,
    `<div><span class="meta-label">Date</span><strong>${escapeHtml(dateLabel(data.date))}</strong></div>`,
    data.dueDate ? `<div><span class="meta-label">${data.kind === "quotation" ? "Valid until" : "Due date"}</span><strong>${escapeHtml(data.dueDate)}</strong></div>` : "",
    data.reference ? `<div><span class="meta-label">${escapeHtml(data.referenceLabel || "Reference")}</span><strong>${escapeHtml(data.reference)}</strong></div>` : "",
  ].filter(Boolean).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} ${escapeHtml(data.number)}</title>
  <style>
    :root{--navy:#12334a;--teal:#16877f;--ink:#203946;--muted:#607581;--line:#cbd9dc;--wash:#edf4f3}
    *{box-sizing:border-box}
    html{background:#e7eeed}
    body{margin:0;color:var(--ink);background:#fff;font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.45}
    .toolbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:12px 20px;background:var(--navy);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 2px 8px rgba(18,51,74,.18)}
    .toolbar label{color:#dceceb;font-size:12px;font-weight:650;letter-spacing:.02em}
    .toolbar select,.toolbar button{height:34px;border:1px solid #a9ceca;border-radius:3px;background:#fff;color:var(--navy);padding:0 11px;font:600 12px system-ui,-apple-system,"Segoe UI",sans-serif}
    .toolbar button{background:var(--teal);border-color:var(--teal);color:#fff;cursor:pointer}
    .toolbar button:hover{background:#116d67}
    .sheet{width:calc(100% - 40px);max-width:210mm;margin:28px auto;padding:13mm;background:#fff;box-shadow:0 10px 35px rgba(18,51,74,.12)}
    html[data-paper="A5"] .sheet{max-width:148mm;padding:9mm}
    html[data-paper="A5"] .meta-label{min-width:66px}
    html[data-paper="A5"] .summary{width:58%}
    .masthead{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:start;padding-top:8px}
    .wordmark{color:var(--navy);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:22px;font-weight:800;letter-spacing:.17em;line-height:1}
    .submark{margin-top:7px;color:var(--teal);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
    .contact{color:var(--muted);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:10px;line-height:1.55;text-align:right}
    .title{text-align:center;color:var(--teal);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:27px;letter-spacing:.12em;line-height:1.1;margin:31px 0 24px;text-transform:uppercase}
    .identity{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:0 0 22px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    .meta{display:grid;align-content:start;gap:9px}
    .meta>div{display:flex;gap:9px;min-width:0}
    .meta-label{min-width:84px;color:var(--muted);font-size:9px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}
    .meta strong{color:var(--navy);font-size:11px;font-weight:650;overflow-wrap:anywhere}
    .recipient{min-width:0;font-size:11px;overflow-wrap:anywhere}
    .recipient strong{display:block;color:var(--navy);font-size:13px}
    .recipient div{margin-top:3px;color:var(--muted);white-space:pre-line}
    .divider{height:2px;background:var(--teal);margin-bottom:21px}
    .intro{display:grid;grid-template-columns:30% 1fr;gap:25px;margin-bottom:24px}
    .eyebrow{color:var(--navy);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
    .intro-copy,.notes-copy{white-space:pre-wrap;color:var(--ink);font-size:11px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:4px;page-break-inside:auto}
    thead{display:table-header-group}
    thead tr{background:var(--teal);color:#fff}
    th{padding:10px 11px;text-align:left;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:9px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}
    th.quantity,td.quantity{width:14%;text-align:center}
    th.amount,td.amount{width:19%;text-align:right}
    td{padding:12px 11px;border-bottom:1px solid var(--line);color:var(--ink);font-size:11px;vertical-align:top;overflow-wrap:anywhere;page-break-inside:avoid}
    tbody tr{page-break-inside:avoid}
    tbody tr:nth-child(even){background:#f5f8f7}
    .description{width:48%}
    .summary{width:44%;margin:17px 0 0 auto;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    .summary-row,.summary-total{display:flex;justify-content:space-between;gap:20px;padding:5px 0;color:var(--muted);font-size:10px}
    .summary-row strong{color:var(--ink);font-weight:600}
    .summary-total{margin-top:5px;border-top:2px solid var(--teal);background:var(--teal);color:#fff;padding:9px 10px;font-size:12px;font-weight:750}
    .summary-total strong{color:#fff}
    .payment-details{margin-top:10px;border-top:1px solid var(--line);padding-top:5px}
    .lower{margin-top:22px;padding-top:18px;border-top:2px solid var(--teal)}
    .lower-grid{display:grid;grid-template-columns:30% 1fr;gap:25px}
    .notes-copy{font-family:Georgia,"Times New Roman",serif}
    .closing{margin-top:17px;color:var(--navy);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:10px;font-weight:750;letter-spacing:.04em;text-transform:uppercase}
    .signature{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:31px;max-width:440px;break-inside:avoid}
    .sign-line{border-top:1px solid var(--navy);padding-top:7px;color:var(--muted);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:9px}
    @media(max-width:600px){.toolbar{justify-content:space-between;padding:10px 12px}.sheet,html[data-paper="A5"] .sheet{width:calc(100% - 24px);margin:18px auto;padding:16px}.masthead{grid-template-columns:1fr;gap:13px}.contact{text-align:left}.title{font-size:22px;margin:24px 0 19px}.identity,.intro,.lower-grid{grid-template-columns:1fr;gap:12px}.summary,html[data-paper="A5"] .summary{width:100%}th,td{padding-left:6px;padding-right:6px;font-size:10px}.description{width:auto}th.amount,td.amount{width:23%}}
    @media print{
      @page{size:A4;margin:14mm 13mm}
      html{background:#fff}
      body{background:#fff}
      .toolbar{display:none}
       .sheet,html[data-paper="A5"] .sheet{width:100%;max-width:none;margin:0;padding:0;box-shadow:none}
       .masthead{grid-template-columns:1fr auto}
       .contact{text-align:right}
       .identity{grid-template-columns:1fr 1fr;gap:20px}
       .meta{grid-template-columns:1fr;gap:9px}
       .intro,.lower-grid{grid-template-columns:30% 1fr}
       .summary{width:44%}
       html[data-paper="A5"] .summary{width:58%}
       .masthead,.identity,.intro,.lower,.summary{break-inside:avoid}
       tbody tr{break-inside:avoid}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  </style>
</head>
<body>
  <div class="toolbar" aria-label="Print controls">
    <label for="paper-size">Paper size</label>
    <select id="paper-size" aria-label="Paper size">
      <option value="A4">A4</option>
      <option value="A5">A5</option>
    </select>
    <button type="button" id="print-document">Print</button>
  </div>
  <main class="sheet">
    <header class="masthead">
       <div><div class="wordmark">INFINITE HOME</div><div class="submark">Premium home essentials</div></div>
      <div class="contact">Male’, Maldives<br>support@infinitehome.mv</div>
    </header>
    <h1 class="title">${escapeHtml(title)}</h1>
     <section class="identity">
       <div class="meta">${details}</div>
       <div class="recipient"><span class="meta-label">${isDeliveryNote ? "Deliver to" : data.kind === "quotation" ? "Prepared for" : "Bill to"}</span><strong>${escapeHtml(data.partyName)}</strong>${contactLines.map(line => `<div>${escapeHtml(line)}</div>`).join("")}</div>
     </section>
    <div class="divider"></div>
    ${data.notes ? `<section class="intro"><div class="eyebrow">${isDeliveryNote ? "Delivery details" : "Description / notes"}</div><div class="intro-copy">${escapeHtml(data.notes)}</div></section>` : ""}
    <table>
      <thead><tr><th class="description">Description</th><th class="quantity">Quantity</th>${isDeliveryNote ? "" : "<th class=\"amount\">Unit price</th><th class=\"amount\">Amount</th>"}</tr></thead>
      <tbody>${rows || `<tr><td class="description">No line items listed</td><td class="quantity">—</td>${isDeliveryNote ? "" : "<td class=\"amount\">—</td><td class=\"amount\">—</td>"}</tr>`}</tbody>
    </table>
     ${isDeliveryNote ? "" : `<section class="summary">${summary}${total}${payment}</section>`}
     ${(data.closingText || data.signature) ? `<section class="lower"><div class="lower-grid"><div class="eyebrow">${isDeliveryNote ? "Delivery confirmation" : data.signature ? "Terms & conditions" : "Closing note"}</div><div class="notes-copy">${data.closingText ? escapeHtml(data.closingText) : ""}${data.signature ? `<div class="closing">${isDeliveryNote ? "Please confirm receipt of these items" : "Please confirm your acceptance of this document"}</div><div class="signature"><div class="sign-line">${isDeliveryNote ? "Received by (signature / printed name)" : "Signature over printed name"}</div><div class="sign-line">${isDeliveryNote ? "Date received" : "Date signed"}</div></div>` : ""}</div></div></section>` : ""}
  </main>
  <script>
    (function(){
      var select=document.getElementById("paper-size");
      var printButton=document.getElementById("print-document");
       function setSize(){var size=select.value==="A5"?"A5":"A4";document.documentElement.dataset.paper=size;var style=document.getElementById("dynamic-page-size");if(!style){style=document.createElement("style");style.id="dynamic-page-size";document.head.appendChild(style)}style.textContent="@page{size:"+size+";margin:"+(size==="A5"?"9mm":"14mm 13mm")+"}";}
      select.addEventListener("change",setSize);
      printButton.addEventListener("click",function(){setSize();window.print();});
      setSize();
    }());
  </script>
</body>
</html>`;
}

export function openBusinessPrint(data: PrintDocumentData): boolean {
  if (typeof window === "undefined") return false;
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.document.open();
  popup.document.write(renderBusinessDocument(data));
  popup.document.close();
  popup.focus();
  return true;
}