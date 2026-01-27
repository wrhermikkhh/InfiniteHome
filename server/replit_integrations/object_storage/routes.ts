import type { Express } from "express";
import { supabaseAdmin } from "../../lib/supabase";
import { randomUUID } from "crypto";

export function registerObjectStorageRoutes(app: Express): void {
  // Product images upload endpoint (Public Bucket)
  app.post("/api/uploads/product-images", async (req, res) => {
    try {
      const { name, contentType } = req.body;
      if (!name) return res.status(400).json({ error: "Missing name" });

      const fileExt = name.split('.').pop();
      const fileName = `${randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;
      const bucket = "product-images";

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(filePath);

      if (error) throw error;

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;

      res.json({
        uploadURL: data.signedUrl,
        objectPath: publicUrl, // We return the public URL directly now
        metadata: { name, contentType },
      });
    } catch (error) {
      console.error("Error generating Supabase upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Payment slips upload endpoint (Private Bucket)
  app.post("/api/uploads/payment-slips", async (req, res) => {
    try {
      const { name, contentType } = req.body;
      if (!name) return res.status(400).json({ error: "Missing name" });

      const fileExt = name.split('.').pop();
      const fileName = `${randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;
      const bucket = "payment-slips";

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(filePath);

      if (error) throw error;

      res.json({
        uploadURL: data.signedUrl,
        objectPath: filePath, // For private files, we store just the path/filename
        metadata: { name, contentType },
      });
    } catch (error) {
      console.error("Error generating Supabase upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Proxy for private files (payment slips)
  app.get("/objects/payment-slips/*filePath", async (req, res) => {
    try {
      const filePath = req.params.filePath;
      const { data, error } = await supabaseAdmin.storage
        .from("payment-slips")
        .download(filePath);

      if (error) throw error;

      const buffer = Buffer.from(await data.arrayBuffer());
      res.set("Content-Type", data.type);
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading from Supabase:", error);
      res.status(404).json({ error: "File not found" });
    }
  });
}

