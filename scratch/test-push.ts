import fs from "fs";
import path from "path";
import crypto from "crypto";

// 1. Parse .env.local manually (ensures zero external dependency issues)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local file not found at " + envPath);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.substring(0, index).trim();
    let val = trimmed.substring(index + 1).trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  });
  return env;
}

// Helper to generate Google OAuth2 Access Token for FCM HTTP v1 using native NodeJS crypto
async function getFcmAccessToken(serviceAccount: any): Promise<string> {
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

async function run() {
  console.log("🚀 Starting Outbound Push Notification Test Script...");
  
  // 1. Load environment variables
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or Anon Key is missing in .env.local!");
  }
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing in .env.local!");
  }

  // 2. Fetch the most recent FCM token registered in Supabase OR use the command-line argument
  let targetToken = "";
  let deviceName = "Manual CLI Token";

  const argToken = process.argv[2];
  if (argToken) {
    targetToken = argToken.trim();
    console.log("👉 Using token provided in command-line argument.");
  } else {
    console.log("📡 Fetching the most recent active FCM token from Supabase fcm_tokens table...");
    const fetchUrl = `${supabaseUrl}/rest/v1/fcm_tokens?select=token,device_name&order=last_seen_at.desc&limit=1`;
    const dbResponse = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    if (!dbResponse.ok) {
      throw new Error(`Failed to query Supabase DB: ${dbResponse.statusText} (${dbResponse.status})`);
    }

    const tokenRecords = await dbResponse.json();
    if (!tokenRecords || tokenRecords.length === 0) {
      console.log("❌ No registered FCM tokens found in fcm_tokens table! (Supabase RLS privacy policies block public select queries).");
      console.log("💡 Tip: Copy the token printed in your Safari browser console and run:");
      console.log('   npx tsx scratch/test-push.ts "YOUR_SAFARI_TOKEN_HERE"');
      return;
    }

    targetToken = tokenRecords[0].token;
    deviceName = tokenRecords[0].device_name || "Unknown Browser";
  }

  console.log(`✅ Target Push Device: "${deviceName}"`);
  console.log(`🔑 Token Preview: ${targetToken.substring(0, 15)}...`);

  // 3. Authenticate with Google
  console.log("🔐 Authenticating with Google OAuth2 FCM Gate...");
  const serviceAccount = JSON.parse(serviceAccountJson);
  const accessToken = await getFcmAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id || "veilo-campus-chat";
  console.log("🔑 Google Access Token successfully generated.");

  // 4. Send Test Notification payload
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  console.log("✈️ Dispatching push payload to Google's FCM endpoint...");
  
  const payload = {
    message: {
      token: targetToken,
      notification: {
        title: "🦊 Silent Falcon (via Veilo)",
        body: "Hey! Are you guys coming to the department auditorium today? 🎭",
      },
      data: {
        roomId: "00000000-0000-0000-0000-000000000000", // Global Room fallback
        click_action: "/chats",
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          click_action: "/chats",
          vibrate: [200, 100, 200], // Premium double-pulse vibration haptics
          renotify: true, // Re-plays haptics for subsequent messages in the same thread
          tag: "room-dm-verification",
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
    console.error("❌ Google FCM API rejected the message dispatch:", result);
    return;
  }

  console.log("\n⭐️⭐️⭐️ SUCCESS! ⭐️⭐️⭐️");
  console.log(`Message successfully sent to Google FCM Gateway. Msg ID: ${result.name}`);
  console.log("Check your Safari browser/macOS notification tray! You should see your verified push notification arrive instantly.");
}

run().catch((err) => {
  console.error("❌ Fatal Error during test dispatch:", err);
});
