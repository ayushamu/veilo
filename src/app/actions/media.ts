"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

// Cloudflare R2 S3-Compatible Client Initialization
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "mock-access-key",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "mock-secret-key",
  },
});

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
  contentType: string
): Promise<{ success: boolean; message?: string; data?: PresignedResponse }> {
  try {
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

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || "veilo-chat-media",
      Key: objectKey,
      ContentType: contentType,
    });

    // Sign the URL with 15-minute expiration
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

    return {
      success: true,
      data: {
        uploadUrl,
        fileUrl: `/api/media/${roomId}/${fileId}-${cleanFileName}`, // Dynamic secure proxy route
      },
    };
  } catch (err) {
    console.error("Error generating presigned R2 upload tunnel:", err);
    return {
      success: false,
      message: "Server failed to establish secure upload connection.",
    };
  }
}
