import { supabaseAdmin } from './supabase';
import { randomUUID } from 'crypto';

const PRODUCT_IMAGES_BUCKET = 'product-images';
const PAYMENT_SLIPS_BUCKET = 'payment-slips';

/**
 * Upload a file to Supabase Storage
 */
export async function uploadToSupabase(
  bucket: string,
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ publicUrl: string; path: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  // Get public URL for product images
  if (bucket === PRODUCT_IMAGES_BUCKET) {
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return {
      publicUrl: urlData.publicUrl,
      path: filePath
    };
  }

  // For payment slips (private), return signed URL
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days expiry

  if (signedError) {
    throw new Error(`Failed to create signed URL: ${signedError.message}`);
  }

  return {
    publicUrl: signedData.signedUrl,
    path: filePath
  };
}

/**
 * Generate a unique file path for uploads
 */
export function generateFilePath(folder: string, originalName: string): string {
  const uuid = randomUUID();
  const ext = originalName.split('.').pop() || 'jpg';
  return `${folder}/${uuid}.${ext}`;
}

/**
 * Get a signed URL for viewing payment slips (admin only)
 */
export async function getPaymentSlipUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(PAYMENT_SLIPS_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour expiry

  if (error) {
    throw new Error(`Failed to get payment slip URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFromSupabase(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete from Supabase: ${error.message}`);
  }
}

export { PRODUCT_IMAGES_BUCKET, PAYMENT_SLIPS_BUCKET };
