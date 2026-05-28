"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_UPLOAD_CONTENT_TYPE = "image/webp";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function getR2Config() {
  const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
    process.env;

  if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error("R2 media storage is not configured.");
  }

  return { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME };
}

function createR2Client() {
  const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

export interface PresignedResponse {
  uploadUrl: string;
  fileUrl: string;
}

/**
 * Generates a secure, 15-minute presigned PUT URL for Cloudflare R2.
 * Strictly verifies room participation in PostgreSQL before issuing.
 */
export async function getPresignedUploadUrl(
  roomId: string,
  fileName: string,
  contentType: string,
  fileSizeBytes: number
): Promise<{ success: boolean; message?: string; data?: PresignedResponse }> {
  try {
    if (contentType !== ALLOWED_UPLOAD_CONTENT_TYPE) {
      return { success: false, message: "Only optimized WebP images can be uploaded." };
    }

    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > MAX_UPLOAD_BYTES) {
      return { success: false, message: "Images must be 15 MB or smaller." };
    }

    const supabase = await createClient();

    // 1. Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Authentication session expired." };
    }

    // 2. Enforce room participation check before allowing upload
    const { data: participant, error: partError } = await supabase
      .from("room_participants")
      .select("profile_id")
      .eq("room_id", roomId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (partError || !participant) {
      return {
        success: false,
        message: "Access denied: You are not a member of this chat room.",
      };
    }

    // 3. Generate randomized unique key path
    const fileId = crypto.randomUUID();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const objectKey = `rooms/${roomId}/${fileId}-${cleanFileName}`;
    const { R2_BUCKET_NAME } = getR2Config();

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    // Sign the URL with 15-minute expiration
    const uploadUrl = await getSignedUrl(createR2Client(), command, { expiresIn: 900 });

    return {
      success: true,
      data: {
        uploadUrl,
        fileUrl: `/api/media/${roomId}/${fileId}-${cleanFileName}`, // Dynamic secure proxy route
      },
    };
  } catch (err: any) {
    console.error("Error generating presigned R2 upload tunnel:", err);
    return {
      success: false,
      message: err.message || "Server failed to establish secure upload connection.",
    };
  }
}
