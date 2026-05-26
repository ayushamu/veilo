"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useBackgroundCleanup } from "@/hooks/use-cleanup";

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

type InboxContextValue = {
  rooms: ChatRoom[];
  loadingInitial: boolean;
  refreshing: boolean;
  lastSyncedAt: number | null;
  currentUserId: string | null;
  refreshInbox: (options?: RefreshOptions) => Promise<void>;
  patchRoom: (roomId: string, partialRoomState: Partial<ChatRoom>) => void;
};

const InboxContext = createContext<InboxContextValue | null>(null);

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
    const isFresh =
      parsed.lastSyncedAt !== null && Date.now() - parsed.lastSyncedAt < CACHE_TTL_MS;

    if (!isFresh) {
      return {
        rooms: parsed.rooms || [],
        currentUserId: parsed.currentUserId || null,
        lastSyncedAt: parsed.lastSyncedAt || null,
      };
    }

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

export function InboxProvider({ children }: { children: React.ReactNode }) {
  useBackgroundCleanup();
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);

  const persistRooms = useCallback((nextRooms: ChatRoom[], userId: string | null) => {
    const syncedAt = Date.now();
    setRooms(nextRooms);
    roomsRef.current = nextRooms;
    setCurrentUserId(userId);
    setLastSyncedAt(syncedAt);
    writeCache({
      rooms: nextRooms,
      currentUserId: userId,
      lastSyncedAt: syncedAt,
    });
  }, []);

  const loadRoomsFromTables = useCallback(
    async (userId: string): Promise<ChatRoom[]> => {
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
    },
    [supabase]
  );

  const refreshInbox = useCallback(
    async (options: RefreshOptions = {}) => {
      const shouldBlock = !options.silent && rooms.length === 0;

      if (shouldBlock) setLoadingInitial(true);
      setRefreshing(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          persistRooms([], null);
          return;
        }

        setCurrentUserId(user.id);

        const { data, error } = await supabase.rpc("get_chat_inbox");
        const fetchedRooms = error
          ? await loadRoomsFromTables(user.id)
          : ((data || []) as InboxRow[]).map(mapInboxRow);

        persistRooms(fetchedRooms, user.id);
      } catch (err) {
        console.error("Error refreshing chat inbox:", err);
      } finally {
        setLoadingInitial(false);
        setRefreshing(false);
      }
    },
    [loadRoomsFromTables, persistRooms, rooms.length, supabase]
  );

  const patchRoom = useCallback(
    (roomId: string, partialRoomState: Partial<ChatRoom>) => {
      setRooms((currentRooms) => {
        const nextRooms = currentRooms.map((room) =>
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
        roomsRef.current = sortedRooms;
        writeCache({
          rooms: sortedRooms,
          currentUserId,
          lastSyncedAt,
        });
        return sortedRooms;
      });
    },
    [currentUserId, lastSyncedAt]
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshInbox({ silent: true });
    }, 250);
  }, [refreshInbox]);

  useEffect(() => {
    const cachedInbox = readCache();
    if (cachedInbox.rooms.length > 0) {
      roomsRef.current = cachedInbox.rooms;
      queueMicrotask(() => {
        setRooms(cachedInbox.rooms);
        setCurrentUserId(cachedInbox.currentUserId);
        setLastSyncedAt(cachedInbox.lastSyncedAt);
        setLoadingInitial(false);
      });
    }

    const timer = setTimeout(() => {
      refreshInbox({ silent: roomsRef.current.length > 0 });
    }, 0);

    return () => clearTimeout(timer);
    // Run only once on provider mount. Realtime handles later refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

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
  }, [currentUserId, scheduleRefresh, supabase]);

  const value = useMemo(
    () => ({
      rooms,
      loadingInitial,
      refreshing,
      lastSyncedAt,
      currentUserId,
      refreshInbox,
      patchRoom,
    }),
    [
      rooms,
      loadingInitial,
      refreshing,
      lastSyncedAt,
      currentUserId,
      refreshInbox,
      patchRoom,
    ]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInboxStore() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error("useInboxStore must be used inside InboxProvider.");
  }

  return context;
}
