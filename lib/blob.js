import { put, del } from "@vercel/blob";
import { ValidationError } from "@/lib/workspace";

// Matches the serverActions.bodySizeLimit set in next.config.mjs — keep both in sync.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Uploads a File (from FormData) to Vercel Blob and returns the metadata to persist. */
export async function uploadAttachment(file) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set — file uploads are not configured.");
  }
  if (!file || typeof file === "string" || file.size === 0) {
    throw new ValidationError("Choose a file to upload.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError(`File must be ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB or smaller.`);
  }

  const blob = await put(`attachments/${file.name}`, file, { access: "public" });
  return { url: blob.url, filename: file.name, size: file.size };
}

/** Best-effort cleanup — called after the DB row is already deleted. */
export async function deleteAttachmentBlob(url) {
  await del(url);
}
