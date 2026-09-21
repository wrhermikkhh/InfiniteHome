import express, { type Request, type Response, type NextFunction } from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerRoutes } from "../server/routes.js";
import { storage } from "../server/storage.js";

// Both deployments use the same auth, catalog quote and inventory transaction
// implementation. Do not recreate schema/storage/payment routers in this entry.
const app = express();
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buffer) => { (req as any).rawBody = buffer; },
}));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
const canonical = "https://infinite-home.vercel.app";
let baseHtml = "";
function template() {
  if (baseHtml) return baseHtml;
  for (const file of ["api/template.html", "dist/public/index.html"]) {
    try { baseHtml = readFileSync(join(process.cwd(), file), "utf8"); return baseHtml; } catch {}
  }
  return "";
}
function injectOg(html: string, og: { title: string; description: string; image: string; url: string }) {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let result = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(og.title)}</title>`);
  for (const [key, value] of Object.entries(og)) {
    result = result.replace(new RegExp(`<meta property="og:${key}"[^>]*\\/?>`), `<meta property="og:${key}" content="${escape(value)}" />`);
    result = result.replace(new RegExp(`<meta name="twitter:${key}"[^>]*\\/?>`), `<meta name="twitter:${key}" content="${escape(value)}" />`);
  }
  return result;
}
const ready = registerRoutes(createServer(app), app).then(() => {
  app.get("/track", async (req, res) => {
    const html = template();
    if (!html) return res.redirect(302, "/");
    const number = typeof req.query.order === "string" ? req.query.order : "";
    const og = {
      title: "Order Tracking - INFINITE HOME",
      description: "Track your INFINITE HOME order or delivery in real time.",
      image: `${canonical}/opengraph.jpg`,
      url: `${canonical}/track${number ? `?order=${encodeURIComponent(number)}` : ""}`,
    };
    try {
      if (number) {
        const order = await storage.getOrderByNumber(number);
        if (order) {
          og.title = `Order #${number} - INFINITE HOME`;
          og.description = `Track your order of ${order.items?.length || 1} item(s). Current status: ${(order.status || "").replace(/_/g, " ")}.`;
        } else {
          const sale = await storage.getPosTransactionByNumber(number) || await storage.getPosTransactionByTrackingNumber(number);
          if (sale) {
            og.title = `Tracking #${sale.trackingNumber || number} - INFINITE HOME`;
            og.description = `Delivery status: ${(sale.deliveryStatus || "label created").replace(/_/g, " ")}. Track your INFINITE HOME delivery in real time.`;
          }
        }
      }
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return res.type("html").send(injectOg(html, og));
    } catch {
      return res.status(503).type("text").send("Tracking is temporarily unavailable. Please retry.");
    }
  });
  app.get("/product/:id", async (req, res) => {
    const html = template();
    if (!html) return res.redirect(302, "/");
    const og = {
      title: "INFINITE HOME - Premium Bedding, Furniture & Home Appliances",
      description: "Shop premium bedding, luxury furniture, and home appliances at INFINITE HOME.",
      image: `${canonical}/opengraph.jpg`,
      url: `${canonical}/product/${encodeURIComponent(req.params.id)}`,
    };
    try {
      const product = await storage.getProduct(req.params.id);
      if (product) {
        og.title = `${product.name} - INFINITE HOME`;
        og.description = product.description || og.description;
        if (product.images?.[0]) og.image = product.images[0];
      }
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.type("html").send(injectOg(html, og));
    } catch {
      return res.status(503).type("text").send("Product information is temporarily unavailable. Please retry.");
    }
  });
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.status || 500).json({ message: "Request could not complete. Please retry." });
  });
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ready;
    app(req as any, res as any);
  } catch {
    res.status(503).json({ message: "Service initialization unavailable" });
  }
}