import { getSupabase } from "@/lib/supabase";

export const SOURCE_FILE_BUCKET = "wright-source-files";

export async function storeOriginalFile(params: {
  documentId: string;
  sourceFileId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const sb = getSupabase();
  const storagePath = `imports/${params.documentId}/${params.sourceFileId}/${safeStorageFilename(
    params.filename
  )}`;

  let upload = await sb.storage
    .from(SOURCE_FILE_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType || "application/octet-stream",
      upsert: true,
    });

  if (isMissingBucketError(upload.error)) {
    const created = await sb.storage.createBucket(SOURCE_FILE_BUCKET, {
      public: false,
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }
    upload = await sb.storage
      .from(SOURCE_FILE_BUCKET)
      .upload(storagePath, params.buffer, {
        contentType: params.mimeType || "application/octet-stream",
        upsert: true,
      });
  }

  if (upload.error) throw new Error(upload.error.message);
  return storagePath;
}

export function safeStorageFilename(filename: string): string {
  const clean = filename
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "document";
}

function isMissingBucketError(error: { message?: string } | null) {
  return Boolean(error?.message && /bucket.*not.*found|not found/i.test(error.message));
}
