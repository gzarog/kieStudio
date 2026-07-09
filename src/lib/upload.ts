import { postToWorker } from "./kieClient";

/** Upload API caps files at 10MB for images — reject early client-side. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface UploadResult {
  fileUrl: string;
  fileName?: string;
  expiresAt?: string;
}

/** Read a File into a data: URL (base64) for the upload proxy. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a local file through the worker proxy to kie.ai's File Upload API.
 * Returns the hosted URL to pass in i2i/i2v `input` fields.
 */
export async function uploadFile(file: File, uploadPath = "images"): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large (max 10MB).");
  }
  const base64Data = await fileToDataUrl(file);
  return postToWorker<UploadResult>("/upload", {
    base64Data,
    fileName: file.name,
    uploadPath,
  });
}
