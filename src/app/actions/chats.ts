"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResponse } from "./auth";

/**
 * Resolves or creates a secure direct messaging room between the current user and the target student.
 * If either user has blocked the other, it returns an ambiguous "Chat unavailable" error to preserve privacy.
 */
export async function resolveDirectMessageRoom(
  targetProfileId: string
): Promise<ActionResponse<string>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Chat unavailable" };
    }

    // A student cannot create a direct message chat with themselves
    if (user.id === targetProfileId) {
      return { success: false, message: "Chat unavailable" };
    }

    // 1. Query existing direct room with both participants
    const { data: existingRoomId, error: findError } = await supabase.rpc(
      "find_matching_dm_room",
      {
        user_a: user.id,
        user_b: targetProfileId,
      }
    );

    if (!findError && existingRoomId) {
      return { success: true, data: existingRoomId };
    }

    // 2. If no room exists, create one via RPC which checks blocks and provisions participants
    const { data: newRoomId, error: createError } = await supabase.rpc(
      "create_dm_room",
      {
        user_a: user.id,
        user_b: targetProfileId,
      }
    );

    if (createError || !newRoomId) {
      throw new Error(createError?.message || "Failed to create DM room.");
    }

    return { success: true, data: newRoomId };
  } catch (err) {
    console.error("resolveDirectMessageRoom error:", err);
    return { success: false, message: "Chat unavailable" };
  }
}
