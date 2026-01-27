import { useState, useCallback } from "react";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata?: UploadMetadata;
  method?: string;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
  endpoint?: string;
}

/**
 * React hook for handling file uploads to Supabase Storage.
 * 
 * This hook handles two upload methods:
 * 1. Direct upload (Replit): Server handles file upload via FormData
 * 2. Signed URL (Vercel): Server returns signed URL, client uploads directly to Supabase
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Upload a file to the server.
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const uploadEndpoint = options.endpoint || "/api/uploads/product-images";
        
        const formData = new FormData();
        formData.append('file', file);

        setProgress(20);

        // First, try to upload via FormData (works on Replit)
        const response = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details || "Failed to upload file");
        }

        const uploadResponse = await response.json();
        
        // Check if server returned a signed URL (Vercel approach)
        if (uploadResponse.method === "signed_url" && uploadResponse.uploadURL) {
          setProgress(40);
          
          // Upload file directly to Supabase using the signed URL
          const supabaseResponse = await fetch(uploadResponse.uploadURL, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });

          if (!supabaseResponse.ok) {
            const errorText = await supabaseResponse.text();
            console.error("Supabase upload error:", errorText);
            throw new Error("Failed to upload to storage");
          }

          setProgress(100);
          
          // Return the public URL path
          const result = {
            uploadURL: uploadResponse.uploadURL,
            objectPath: uploadResponse.objectPath,
            metadata: {
              name: file.name,
              size: file.size,
              contentType: file.type,
            },
          };
          
          options.onSuccess?.(result);
          return result;
        }

        // Direct upload response (Replit approach)
        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options]
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}
