"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { useBackgroundCleanup } from "@/hooks/use-cleanup";
import { usePresenceTracker } from "@/hooks/use-presence-tracker";

const CACHE_KEY = "veilo:chat-inbox:v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface ChatRoom {
  id: string;
  name: string;
  avatar_emoji: string;
  type: "direct" | "group";
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isMuted: boolean;
  lastMessageAt: string | null;
}

interface InboxRow {
  room_id: string;
  room_name: string;
  avatar_emoji: string;
  type: "direct" | "group";
  last_message: string;
  last_message_at: string | null;
  unread_count: number;
  is_muted: boolean;
}

type ParticipantRow = {
  room_id: string;
  last_read_at: string;
  is_muted: boolean;
  rooms:
    | {
        id: string;
        type: "direct" | "group";
        name: string | null;
        avatar_emoji: string | null;
      }
    | {
        id: string;
        type: "direct" | "group";
        name: string | null;
        avatar_emoji: string | null;
      }[]
    | null;
};

type InboxCache = {
  rooms: ChatRoom[];
  currentUserId: string | null;
  lastSyncedAt: number | null;
};

type RefreshOptions = {
  silent?: boolean;
};

function formatTimestamp(value: string | null) {
  if (!value) return "New";

  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function mapInboxRow(row: InboxRow): ChatRoom {
  return {
    id: row.room_id,
    name: row.room_name,
    avatar_emoji: row.avatar_emoji,
    type: row.type,
    lastMessage: row.last_message,
    timestamp: formatTimestamp(row.last_message_at),
    unreadCount: Number(row.unread_count || 0),
    isMuted: Boolean(row.is_muted),
    lastMessageAt: row.last_message_at,
  };
}

function sortRooms(rooms: ChatRoom[]) {
  return [...rooms].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

function readCache(): InboxCache {
  if (typeof window === "undefined") {
    return { rooms: [], currentUserId: null, lastSyncedAt: null };
  }

  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { rooms: [], currentUserId: null, lastSyncedAt: null };

    const parsed = JSON.parse(raw) as InboxCache;
    return {
      rooms: parsed.rooms || [],
      currentUserId: parsed.currentUserId || null,
      lastSyncedAt: parsed.lastSyncedAt || null,
    };
  } catch {
    return { rooms: [], currentUserId: null, lastSyncedAt: null };
  }
}

function writeCache(cache: InboxCache) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Session storage is a speed optimization only.
  }
}

export interface InboxState {
  rooms: ChatRoom[];
  loadingInitial: boolean;
  refreshing: boolean;
  lastSyncedAt: number | null;
  currentUserId: string | null;
  
  setRooms: (rooms: ChatRoom[]) => void;
  setLoadingInitial: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setCurrentUserId: (userId: string | null) => void;
  
  initializeFromCache: () => void;
  refreshInbox: (options?: RefreshOptions) => Promise<void>;
  patchRoom: (roomId: string, partialRoomState: Partial<ChatRoom>) => void;
}

export const useInboxZustandStore = create<InboxState>((set, get) => {
  const supabase = createClient();

  const loadRoomsFromTables = async (userId: string): Promise<ChatRoom[]> => {
    const { data: participantsData, error } = await supabase
      .from("room_participants")
      .select(
        `
          room_id,
          last_read_at,
          is_muted,
          rooms (
            id,
            type,
            name,
            avatar_emoji
          )
        `
      )
      .eq("profile_id", userId);

    if (error) throw error;

    const fallbackRooms = await Promise.all(
      ((participantsData || []) as unknown as ParticipantRow[]).map(async (item) => {
        const rawRoom = Array.isArray(item.rooms) ? item.rooms[0] : item.rooms;
        if (!rawRoom) return null;

        let name = rawRoom.name || "Anonymous Chat";
        let avatarEmoji = rawRoom.avatar_emoji || "💬";

        if (rawRoom.type === "direct") {
          const { data: peerData } = await supabase
            .from("room_participants")
            .select("profile_id")
            .eq("room_id", rawRoom.id)
            .neq("profile_id", userId)
            .maybeSingle();

          if (peerData?.profile_id) {
            const { data: peerProfile } = await supabase
              .from("profiles")
              .select("nickname, avatar_emoji")
              .eq("id", peerData.profile_id)
              .maybeSingle();

            if (peerProfile) {
              name = peerProfile.nickname;
              avatarEmoji = peerProfile.avatar_emoji;
            }
          }
        }

        const { data: latestMsg } = await supabase
          .from("messages")
          .select("content, type, created_at")
          .eq("room_id", rawRoom.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", rawRoom.id)
          .gt("created_at", item.last_read_at)
          .neq("sender_id", userId);

        return {
          id: rawRoom.id,
          name,
          avatar_emoji: avatarEmoji,
          type: rawRoom.type,
          lastMessage: latestMsg
            ? latestMsg.type === "image"
              ? "Photo"
              : latestMsg.content
            : "Tap to start chatting...",
          timestamp: formatTimestamp(latestMsg?.created_at || null),
          unreadCount: count || 0,
          isMuted: item.is_muted,
          lastMessageAt: latestMsg?.created_at || null,
        };
      })
    );

    return sortRooms(fallbackRooms.filter((room): room is ChatRoom => Boolean(room)));
  };

  return {
    rooms: [],
    loadingInitial: true,
    refreshing: false,
    lastSyncedAt: null,
    currentUserId: null,

    setRooms: (rooms) => set({ rooms }),
    setLoadingInitial: (loadingInitial) => set({ loadingInitial }),
    setRefreshing: (refreshing) => set({ refreshing }),
    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
    setCurrentUserId: (currentUserId) => set({ currentUserId }),

    initializeFromCache: () => {
      const cached = readCache();
      if (cached.rooms.length > 0) {
        set({
          rooms: cached.rooms,
          currentUserId: cached.currentUserId,
          lastSyncedAt: cached.lastSyncedAt,
          loadingInitial: false,
        });
      }
    },

    refreshInbox: async (options = {}) => {
      const state = get();
      const shouldBlock = !options.silent && state.rooms.length === 0;

      if (shouldBlock) set({ loadingInitial: true });
      set({ refreshing: true });

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          set({
            rooms: [],
            currentUserId: null,
            lastSyncedAt: Date.now(),
            loadingInitial: false,
            refreshing: false,
          });
          writeCache({ rooms: [], currentUserId: null, lastSyncedAt: Date.now() });
          return;
        }

        const { data, error } = await supabase.rpc("get_chat_inbox");
        const fetchedRooms = error
          ? await loadRoomsFromTables(user.id)
          : ((data || []) as InboxRow[]).map(mapInboxRow);

        const syncedAt = Date.now();
        set({
          rooms: fetchedRooms,
          currentUserId: user.id,
          lastSyncedAt: syncedAt,
          loadingInitial: false,
          refreshing: false,
        });
        writeCache({
          rooms: fetchedRooms,
          currentUserId: user.id,
          lastSyncedAt: syncedAt,
        });
      } catch (err) {
        console.error("Error refreshing chat inbox:", err);
        set({ refreshing: false, loadingInitial: false });
      }
    },

    patchRoom: (roomId, partialRoomState) => {
      const state = get();
      const nextRooms = state.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              ...partialRoomState,
              timestamp:
                partialRoomState.lastMessageAt !== undefined
                  ? formatTimestamp(partialRoomState.lastMessageAt)
                  : partialRoomState.timestamp || room.timestamp,
            }
          : room
      );

      const sortedRooms = sortRooms(nextRooms);
      set({ rooms: sortedRooms });
      writeCache({
        rooms: sortedRooms,
        currentUserId: state.currentUserId,
        lastSyncedAt: state.lastSyncedAt,
      });
    },
  };
});

export function InboxProvider({ children }: { children: React.ReactNode }) {
  useBackgroundCleanup();
  
  const currentUserId = useInboxZustandStore((state) => state.currentUserId);
  usePresenceTracker(currentUserId);
  const initializeFromCache = useInboxZustandStore((state) => state.initializeFromCache);
  const refreshInbox = useInboxZustandStore((state) => state.refreshInbox);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setup initial state from cache
  useEffect(() => {
    initializeFromCache();
    
    const timer = setTimeout(() => {
      refreshInbox({ silent: true });
    }, 0);

    return () => clearTimeout(timer);
  }, [initializeFromCache, refreshInbox]);

  // Handle Supabase Realtime channel subscriptions
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshInbox({ silent: true });
      }, 250);
    };

    const channel = supabase
      .channel(`chat-inbox:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
          filter: `profile_id=eq.${currentUserId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshInbox]);

  return <>{children}</>;
}

// Selector hook wrapper to maintain backward compatibility
export function useInboxStore<T = InboxState>(
  selector?: (state: InboxState) => T
): T {
  const store = useInboxZustandStore;
  if (selector) {
    return store(selector);
  }
  return store() as unknown as T;
}
