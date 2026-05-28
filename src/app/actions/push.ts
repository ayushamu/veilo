"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

interface FcmTokenRow {
  token: string;
}

// Helper to generate Google OAuth2 Access Token for FCM HTTP v1 using native NodeJS crypto (zero heavy external deps)
async function getFcmAccessToken(serviceAccount: FirebaseServiceAccount): Promise<string> {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = {
      alg: "RS256",
      typ: "JWT",
    };
    const jwtClaim = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const base64Header = Buffer.from(JSON.stringify(jwtHeader)).toString("base64url");
    const base64Claim = Buffer.from(JSON.stringify(jwtClaim)).toString("base64url");
    const signatureInput = `${base64Header}.${base64Claim}`;

    try {
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(signatureInput);
      const signature = sign.sign(serviceAccount.private_key, "base64url");
      const assertion = `${signatureInput}.${signature}`;

      fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: assertion,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.access_token) {
            resolve(data.access_token);
          } else {
            reject(new Error("Failed to exchange JWT for FCM access token: " + JSON.stringify(data)));
          }
        })
        .catch((err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

interface SendDmNotificationPayload {
  roomId: string;
  messageText: string;
}

export async function sendDmNotification({
  roomId,
  messageText,
}: SendDmNotificationPayload) {
  try {
    // 0. Safety Guard: Bypasses push notifications for the Global Campus-Wide Room to prevent
    // server-less timeouts, database CPU locks, and student haptic alert spam.
    if (roomId === "00000000-0000-0000-0000-000000000000") {
      return { success: true, reason: "Bypassed Global shared room notifications" };
    }

    const supabase = await createClient();

    // 1. Authenticate the sending user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn("Unauthorized attempt to dispatch push notifications.");
      return { success: false, reason: "Unauthorized" };
    }

    // 2. Fetch sender profile details securely (respect peer anonymity)
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();
    const senderNickname = senderProfile?.nickname || "Anonymous Student";

    // 3. Fetch active recipient tokens in the room using secure database RPC (verifies membership + blocks)
    const { data: tokensData, error: rpcError } = await supabase.rpc("get_room_recipient_fcm_tokens", {
      room_id: roomId,
    });

    if (rpcError) {
      console.error("Error executing get_room_recipient_fcm_tokens RPC:", rpcError);
      return { success: false, reason: "Database verification failed" };
    }

    if (!tokensData || tokensData.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const tokens = (tokensData as FcmTokenRow[]).map((t) => t.token);

    // 5. Fetch service account JSON from environment
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not defined.");
      return { success: false, reason: "FCM service account configuration missing" };
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as FirebaseServiceAccount;
    const accessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || "veilo-campus-chat";

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const cleanedText = messageText.length > 120 ? messageText.substring(0, 117) + "..." : messageText;

    // 6. Dispatch parallel HTTP push notifications
    const dispatches = tokens.map(async (token: string) => {
      const payload = {
        message: {
          token,
          notification: {
            title: `New message from ${senderNickname}`,
            body: cleanedText,
          },
          data: {
            roomId,
            click_action: `/chats/${roomId}`,
          },
          android: {
            priority: "high",
            notification: {
              click_action: "OPEN_ROOM",
              sound: "default",
            },
          },
          webpush: {
            headers: {
              Urgency: "high",
            },
            notification: {
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              click_action: `/chats/${roomId}`,
              vibrate: [200, 100, 200], // Double-pulse haptics
              renotify: true, // Plays alerts on subsequent updates
              tag: `room-dm-${roomId}`, // Groups chats by room ID thread
              actions: [
                {
                  action: "enter",
                  title: "💬 Chat Now"
                },
                {
                  action: "dismiss",
                  title: "✕ Dismiss"
                }
              ]
            },
          },
        },
      };

      try {
        const response = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          console.warn("FCM dispatch failed.", {
            status: response.status,
            errorStatus: result?.error?.status,
          });
          return { token, success: false, status: response.status };
        }

        return { token, success: true, messageId: result.name };
      } catch (error) {
        console.error("HTTP client exception sending FCM notification:", error);
        return { token, success: false, error };
      }
    });

    const results = await Promise.allSettled(dispatches);
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return { success: true, sentCount: successCount, totalTokens: tokens.length };
  } catch (error) {
    console.error("Exception occurred inside sendDmNotification action:", error);
    return { success: false, error: String(error) };
  }
}
