import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

/**
 * R2 is S3-compatible, so the AWS SDK v3 S3 client works against it
 * unmodified — just point endpoint at the account-scoped R2 URL.
 */
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const PRESIGN_TTL_SECONDS = 5 * 60;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PresignResult {
  uploadUrl: string;
  objectStorageKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType);
}

export { MAX_UPLOAD_BYTES };

/**
 * Client uploads directly to this URL (PUT) — the app server's own
 * bandwidth is never in the path for the actual file bytes, per spec:
 * "client uploads directly to storage, never through the app server."
 */
export async function presignComplaintPhotoUpload(args: {
  societyId: string;
  complaintId: string;
  contentType: string;
}): Promise<PresignResult> {
  const extension = args.contentType.split("/")[1] ?? "bin";
  const objectStorageKey = `societies/${args.societyId}/complaints/${args.complaintId}/${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectStorageKey,
    ContentType: args.contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_TTL_SECONDS });

  return {
    uploadUrl,
    objectStorageKey,
    publicUrl: `${env.R2_PUBLIC_BASE_URL}/${objectStorageKey}`,
    expiresInSeconds: PRESIGN_TTL_SECONDS,
  };
}
