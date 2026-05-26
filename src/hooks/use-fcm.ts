"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFirebaseMessaging } from "@/lib/firebase";
import { getToken } from "firebase/messaging";

export function useFcm() {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check support on mount
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const registerToken = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return null;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.warn("FCM messaging client is not initialized.");
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not defined in environment variables.");
      }

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (currentToken) {
        setToken(currentToken);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Register the token with upsert mapping
          const { error } = await supabase.from("fcm_tokens").upsert(
            {
              profile_id: user.id,
              token: currentToken,
              device_name: navigator.userAgent || "Web App Client",
              last_seen_at: new Date().toISOString(),
            },
            {
              onConflict: "token",
            }
          );

          if (error) {
            console.error("Failed to register token in Supabase fcm_tokens table:", error);
          } else {
            console.log("FCM registration token synchronized successfully.");
          }
        }
        return currentToken;
      } else {
        console.warn("No registration token available. Request permission to generate one.");
        return null;
      }
    } catch (error) {
      console.error("An error occurred while retrieving token:", error);
      return null;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn("Push notifications are not supported on this browser.");
      return false;
    }

    setLoading(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult === "granted") {
        await registerToken();
        setLoading(false);
        return true;
      }
      setLoading(false);
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setLoading(false);
      return false;
    }
  }, [isSupported, registerToken]);

  // Attempt auto-register if permission is already granted and user is authenticated
  useEffect(() => {
    if (isSupported && permission === "granted") {
      registerToken();
    }
  }, [isSupported, permission, registerToken]);

  return {
    token,
    permission,
    isSupported,
    loading,
    requestPermission,
    registerToken,
  };
}
