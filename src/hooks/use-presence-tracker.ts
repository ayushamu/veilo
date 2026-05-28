"use client";

import { useEffect, useRef } from "react";
import { updateLastSeen } from "@/app/actions/profile";

const THROTTLE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes standard update interval
const FOREGROUND_COOLDOWN_MS = 15 * 1000; // 15 seconds cooldown for immediate foreground checkins

export function usePresenceTracker(currentUserId: string | null) {
  const lastUpdatedRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!currentUserId) return;

    const triggerHeartbeat = async (force = false) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdatedRef.current;

      // Rate limit updates to avoid db lockups / rate limits
      if (isUpdatingRef.current) return;
      if (!force && timeSinceLastUpdate < THROTTLE_LIMIT_MS) return;
      if (force && timeSinceLastUpdate < FOREGROUND_COOLDOWN_MS) return;

      isUpdatingRef.current = true;
      try {
        const response = await updateLastSeen();
        if (response.success) {
          lastUpdatedRef.current = Date.now();
        }
      } catch (err) {
        console.error("[Veilo Presence] Error sending active heartbeat:", err);
      } finally {
        isUpdatingRef.current = false;
      }
    };

    // 1. Send initial check-in when mounting / session activates
    triggerHeartbeat(true);

    // 2. Schedule a recurring heartbeat (checks every 30s, triggers if THROTTLE_LIMIT has passed)
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerHeartbeat(false);
      }
    }, 30 * 1000);

    // 3. Setup event listeners for instant foreground check-ins
    const handleActivity = () => {
      if (document.visibilityState === "visible") {
        triggerHeartbeat(true);
      }
    };

    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, [currentUserId]);
}
