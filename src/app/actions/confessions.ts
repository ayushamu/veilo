"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResponse } from "./auth";
import { resolveDirectMessageRoom } from "./chats";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfessionReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Confession {
  id: string;
  content: string;
  mood_emoji: string;
  gradient_id: number;
  allow_dm: boolean;
  created_at: string;
  profile_id: string;
  poster_nickname: string;
  poster_avatar: string;
  reactions: ConfessionReaction[];
  total_reactions: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ─── Read: fetch unseen confessions for the current user ──────────────────────

export async function getNextConfessions(
  limit = 20
): Promise<ActionResponse<Confession[]>> {
  try {
    const { supabase, user } = await getActiveUser();
    if (!user) return { success: false, message: "Not authenticated" };

    let { data: rows, error } = await supabase.rpc("get_unseen_confessions", {
      current_user_id: user.id,
      limit_val: limit,
    });

    if (error) throw error;

    // Fallback: If no unseen confessions, fetch already seen ones (excluding own) to loop
    if (!rows || rows.length === 0) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("confessions")
        .select(`
          id, content, mood_emoji, gradient_id, allow_dm, created_at, profile_id,
          profiles!confessions_profile_id_fkey ( nickname, avatar_emoji ),
          confession_reactions ( emoji, profile_id )
        `)
        .neq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fallbackError) throw fallbackError;

      rows = (fallbackRows ?? []).map((row: any) => ({
        id: row.id,
        profile_id: row.profile_id,
        content: row.content,
        mood_emoji: row.mood_emoji,
        gradient_id: row.gradient_id,
        allow_dm: row.allow_dm,
        created_at: row.created_at,
        poster_nickname: row.profiles?.nickname,
        poster_avatar: row.profiles?.avatar_emoji,
        reactions: row.confession_reactions,
      }));
    }

    const confessions: Confession[] = (rows ?? []).map((row: any) => {
      const allReactions: { emoji: string; profile_id: string }[] =
        row.reactions ?? [];

      // Aggregate reactions by emoji
      const reactionMap = new Map<
        string,
        { count: number; reactedByMe: boolean }
      >();
      for (const r of allReactions) {
        if (!r.emoji) continue;
        const existing = reactionMap.get(r.emoji) ?? {
          count: 0,
          reactedByMe: false,
        };
        reactionMap.set(r.emoji, {
          count: existing.count + 1,
          reactedByMe: existing.reactedByMe || r.profile_id === user.id,
        });
      }

      const reactions: ConfessionReaction[] = Array.from(
        reactionMap.entries()
      ).map(([emoji, { count, reactedByMe }]) => ({ emoji, count, reactedByMe }));

      return {
        id: row.id,
        content: row.content,
        mood_emoji: row.mood_emoji,
        gradient_id: row.gradient_id ?? 0,
        allow_dm: row.allow_dm ?? true,
        created_at: row.created_at,
        profile_id: row.profile_id,
        poster_nickname: row.poster_nickname ?? "Anonymous",
        poster_avatar: row.poster_avatar ?? "👤",
        reactions,
        total_reactions: allReactions.length,
      };
    });

    return { success: true, data: confessions };
  } catch (err) {
    console.error("getNextConfessions:", err);
    return { success: false, message: "Failed to load confessions" };
  }
}

// ─── Read: fetch the current user's own confessions ───────────────────────────

export async function getMyConfessions(): Promise<
  ActionResponse<Confession[]>
> {
  try {
    const { supabase, user } = await getActiveUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const { data: rows, error } = await supabase
      .from("confessions")
      .select(
        `
        id, content, mood_emoji, gradient_id, allow_dm, created_at, profile_id,
        profiles!confessions_profile_id_fkey ( nickname, avatar_emoji ),
        confession_reactions ( emoji, profile_id )
      `
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const confessions: Confession[] = (rows ?? []).map((row: any) => {
      const allReactions: { emoji: string; profile_id: string }[] =
        row.confession_reactions ?? [];
      const reactionMap = new Map<
        string,
        { count: number; reactedByMe: boolean }
      >();
      for (const r of allReactions) {
        const existing = reactionMap.get(r.emoji) ?? {
          count: 0,
          reactedByMe: false,
        };
        reactionMap.set(r.emoji, {
          count: existing.count + 1,
          reactedByMe: existing.reactedByMe || r.profile_id === user.id,
        });
      }
      const reactions: ConfessionReaction[] = Array.from(
        reactionMap.entries()
      ).map(([emoji, { count, reactedByMe }]) => ({ emoji, count, reactedByMe }));

      return {
        id: row.id,
        content: row.content,
        mood_emoji: row.mood_emoji,
        gradient_id: row.gradient_id ?? 0,
        allow_dm: row.allow_dm ?? true,
        created_at: row.created_at,
        profile_id: row.profile_id,
        poster_nickname: row.profiles?.nickname ?? "Anonymous",
        poster_avatar: row.profiles?.avatar_emoji ?? "👤",
        reactions,
        total_reactions: allReactions.length,
      };
    });

    return { success: true, data: confessions };
  } catch (err) {
    console.error("getMyConfessions:", err);
    return { success: false, message: "Failed to load your confessions" };
  }
}

// ─── Write: post a new confession ─────────────────────────────────────────────

export async function postConfession(
  content: string,
  mood_emoji: string,
  gradient_id: number,
  allow_dm: boolean
): Promise<ActionResponse<{ id: string }>> {
  try {
    const { supabase, user } = await getActiveUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 280) {
      return { success: false, message: "Confession must be 1–280 characters" };
    }

    const { data, error } = await supabase
      .from("confessions")
      .insert({
        profile_id: user.id,
        content: trimmed,
        mood_emoji,
        gradient_id,
        allow_dm,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, data: { id: data.id } };
  } catch (err) {
    console.error("postConfession:", err);
    return { success: false, message: "Failed to post confession" };
  }
}

// ─── Write: delete own confession ─────────────────────────────────────────────

export async function deleteConfession(
  id: string
): Promise<ActionResponse<void>> {
  try {
    const { supabase, user } = await getActiveUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const { error } = await supabase
      .from("confessions")
      .delete()
      .eq("id", id)
      .eq("profile_id", user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("deleteConfession:", err);
    return { success: false, message: "Failed to delete confession" };
  }
}

// ─── Write: mark a confession as seen ─────────────────────────────────────────

export async function markConfessionSeen(
  confession_id: string
): Promise<void> {
  try {
    const { supabase, user } = await getActiveUser();
    if (!user) return;

    await supabase
      .from("confession_seen")
      .upsert({ confession_id, profile_id: user.id }, { onConflict: "confession_id,profile_id" });
  } catch {
    // Non-critical — silently fail
  }
}

// ─── Write: react to a confession (toggle) ────────────────────────────────────

export async function reactToConfession(
  confession_id: string,
  emoji: string
): Promise<ActionResponse<{ removed: boolean }>> {
  try {
    const { supabase, user } = await getActiveUser();
    if (!user) return { success: false, message: "Not authenticated" };

    // Check if the user already reacted
    const { data: existing } = await supabase
      .from("confession_reactions")
      .select("emoji")
      .eq("confession_id", confession_id)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji → remove (toggle off)
        await supabase
          .from("confession_reactions")
          .delete()
          .eq("confession_id", confession_id)
          .eq("profile_id", user.id);
        return { success: true, data: { removed: true } };
      } else {
        // Different emoji → update
        await supabase
          .from("confession_reactions")
          .update({ emoji })
          .eq("confession_id", confession_id)
          .eq("profile_id", user.id);
        return { success: true, data: { removed: false } };
      }
    }

    // No existing → insert
    await supabase
      .from("confession_reactions")
      .insert({ confession_id, profile_id: user.id, emoji });

    return { success: true, data: { removed: false } };
  } catch (err) {
    console.error("reactToConfession:", err);
    return { success: false, message: "Failed to react" };
  }
}

// ─── Write: reply to a confession via DM ──────────────────────────────────────

export async function replyToConfession(
  confession_profile_id: string
): Promise<ActionResponse<string>> {
  return resolveDirectMessageRoom(confession_profile_id);
}
