import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// This client is used for server-side operations with full access
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Normalizes the Supabase storage path to a standard format used in the app.
 * Supabase paths are usually: {bucketName}/{folder}/{fileName}
 */
export function normalizeSupabasePath(bucket: string, path: string): string {
  return `https://${new URL(supabaseUrl).hostname}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Extracts bucket and path from a Supabase public URL
 */
export function parseSupabaseUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/storage/v1/object/public/');
    if (pathParts.length < 2) return null;
    
    const fullPath = pathParts[1];
    const firstSlashIndex = fullPath.indexOf('/');
    if (firstSlashIndex === -1) return null;
    
    return {
      bucket: fullPath.substring(0, firstSlashIndex),
      path: fullPath.substring(firstSlashIndex + 1)
    };
  } catch (e) {
    return null;
  }
}
