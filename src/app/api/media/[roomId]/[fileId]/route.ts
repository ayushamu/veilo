import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "mock-access-key",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "mock-secret-key",
  },
});

interface RouteParams {
  params: Promise<{ roomId: string; fileId: string }>;
}

/**
 * GET route handler proxying media downloads from Cloudflare R2 bucket.
 * Restricts binary streaming to room participants only, blocking scraping and direct links.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { roomId, fileId } = await params;
    const supabase = await createClient();

    // 1. Verify user's authenticated session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse("Unauthorized: Please log in.", { status: 401 });
    }

    // 2. Validate room participation before streaming
    const { data: participant, error: partError } = await supabase
      .from("room_participants")
      .select("profile_id")
      .eq("room_id", roomId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (partError || !participant) {
      return new NextResponse("Access Denied: You are not a participant of this chat room.", {
        status: 403,
      });
    }

    // 3. Request object from Cloudflare R2 S3-Compatible bucket
    const objectKey = `rooms/${roomId}/${fileId}`;
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || "veilo-chat-media",
      Key: objectKey,
    });

    const s3Response = await r2.send(command);

    if (!s3Response.Body) {
      return new NextResponse("Asset Not Found.", { status: 404 });
    }

    // 4. Set secure delivery stream headers
    const headers = new Headers();
    headers.set("Content-Type", s3Response.ContentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=31536000, immutable"); // Cache for 1 year securely

    // Convert stream format
    const webStream = s3Response.Body.transformToWebStream();

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Error streaming media proxy asset:", err);
    return new NextResponse("Internal Server Error occurred.", { status: 500 });
  }
}
