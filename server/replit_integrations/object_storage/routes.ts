import type { Express, Request, Response } from "express";
import multer from "multer";
import { supabaseAdmin } from "../../lib/supabase";
import { randomUUID } from "crypto";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const PRODUCT_IMAGES_BUCKET = 'product-images';
const PAYMENT_SLIPS_BUCKET = 'payment-slips';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Register Supabase storage routes for file uploads.
 */
export function registerObjectStorageRoutes(app: Express): void {
  
  // Product images upload endpoint
  app.post("/api/uploads/product-images", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ext = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${randomUUID()}.${ext}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error("Supabase product image upload error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ 
          error: "Failed to upload file", 
          details: error.message || 'Unknown error',
          statusCode: error.statusCode
        });
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      res.json({
        objectPath: urlData.publicUrl,
        uploadURL: urlData.publicUrl,
        metadata: { 
          name: file.originalname, 
          size: file.size, 
          contentType: file.mimetype 
        },
      });
    } catch (error) {
      console.error("Error uploading product image:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Payment slips upload endpoint
  app.post("/api/uploads/payment-slips", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ext = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${randomUUID()}.${ext}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from(PAYMENT_SLIPS_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ error: "Failed to upload file" });
      }

      // For private bucket, return the path (admin will get signed URL when viewing)
      res.json({
        objectPath: filePath,
        uploadURL: filePath,
        metadata: { 
          name: file.originalname, 
          size: file.size, 
          contentType: file.mimetype 
        },
      });
    } catch (error) {
      console.error("Error uploading payment slip:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get signed URL for viewing payment slips (admin use)
  app.post("/api/payment-slips/get-url", async (req: Request, res: Response) => {
    try {
      const { path } = req.body;
      
      if (!path) {
        return res.status(400).json({ error: "Path is required" });
      }
      
      const { data, error } = await supabaseAdmin.storage
        .from(PAYMENT_SLIPS_BUCKET)
        .createSignedUrl(path, 60 * 60); // 1 hour

      if (error) {
        return res.status(404).json({ error: "Payment slip not found" });
      }

      res.json({ url: data.signedUrl });
    } catch (error) {
      console.error("Error getting payment slip URL:", error);
      res.status(500).json({ error: "Failed to get payment slip" });
    }
  });
}
