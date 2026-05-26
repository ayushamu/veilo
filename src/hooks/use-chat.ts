"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { localDB, type LocalMessage } from "@/lib/db/local-db";
import { useChatHistoryStore } from "@/store/chat-history-store";
import Dexie from "dexie";

const PAGE_SIZE = 30;

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_nickname?: string;
  sender_avatar?: string;
  content: string;
  type: "text" | "image" | "system";
  media_url?: string;
  created_at: string;
  reactions?: { [emoji: string]: string[] };
  client_message_id?: string;
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_sender_nickname?: string;
  delivery_status?: "sending" | "sent" | "failed";
  error_message?: string;
  has_media?: number;
}

export type ReplyDraft = {
  messageId: string;
  content: string;
  senderNickname: string;
};

export interface TypingUser {
  id: string;
  nickname: string;
  avatar_emoji: string;
}

type SendMessageOptions = {
  retryClientMessageId?: string;
  replyTo?: ReplyDraft | null;
  type?: "text" | "image";
  mediaUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  blurhash?: string;
};

type RawProfile = {
  nickname?: string;
  avatar_emoji?: string;
};

type RawMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: Message["type"];
  media_url?: string | null;
  created_at: string;
  client_message_id?: string | null;
  reply_to_message_id?: string | null;
  reply_to_content?: string | null;
  reply_to_sender_nickname?: string | null;
  profiles?: RawProfile | RawProfile[] | null;
};

type ReactionRow = {
  message_id: string;
  profile_id: string;
  emoji: string;
};

type RealtimeMessageInsertPayload = {
  new: RawMessage;
};

type RealtimeReactionPayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: ReactionRow;
  old?: ReactionRow;
};

type TypingPresence = {
  typing?: boolean;
};

function getErrorContext(err: unknown) {
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const fallback = Object.getOwnPropertyNames(err).reduce<Record<string, unknown>>(
      (acc, key) => {
        acc[key] = record[key];
        return acc;
      },
      {}
    );

    return {
      message: record.message || fallback.message || JSON.stringify(fallback) || err,
      details: record.details,
      hint: record.hint,
      code: record.code,
      raw: fallback,
    };
  }
  return { message: err };
}

function shouldRetryWithoutClientMessageId(error: unknown) {
  const context = getErrorContext(error);
  const haystack = [
    context.message,
    context.details,
    context.hint,
    context.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("client_message_id") ||
    haystack.includes("schema cache") ||
    haystack.includes("column") ||
    haystack.includes("pgrst204")
  );
}



function formatMessage(msg: RawMessage): Message {
  const rawProfiles = msg.profiles;
  const profile = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles;

  return {
    id: msg.id,
    room_id: msg.room_id,
    sender_id: msg.sender_id,
    sender_nickname: profile?.nickname || "Anonymous Student",
    sender_avatar: profile?.avatar_emoji || "👤",
    content: msg.content,
    type: msg.type,
    media_url: msg.media_url || undefined,
    created_at: msg.created_at,
    client_message_id: msg.client_message_id || undefined,
    reply_to_message_id: msg.reply_to_message_id || undefined,
    reply_to_content: msg.reply_to_content || undefined,
    reply_to_sender_nickname: msg.reply_to_sender_nickname || undefined,
    delivery_status: "sent",
    reactions: {},
    has_media: msg.type === "image" ? 1 : 0
  };
}

const EMPTY_ARRAY: Message[] = [];

export function useChat(roomId: string, currentUserId: string) {
  const supabase = useMemo(() => createClient(), []);
  console.log("useChat hook instantiated/rendered:", { roomId, currentUserId });
  
  // Connect hooks to Zustand transient cache slice
  const hotMessages = useChatHistoryStore((state) => state.hotCache[roomId] || EMPTY_ARRAY);
  const coldHistory = useChatHistoryStore((state) => state.coldHistory[roomId] || EMPTY_ARRAY);
  
  // Combine caches instantly on view access, ensuring strict ID uniqueness
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const combined: Message[] = [];
    
    // Process hot messages first (most up-to-date)
    for (const msg of hotMessages) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        combined.push(msg);
      }
    }
    
    // Append cold history only if not already in hot cache
    for (const msg of coldHistory) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        combined.push(msg);
      }
    }
    
    return combined;
  }, [hotMessages, coldHistory]);

  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderLoadError, setOlderLoadError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [hasMore, setHasMore] = useState(true);
  
  const channelRef = useRef<{ track: (payload: { typing: boolean }) => unknown } | null>(null);
  const profileCacheRef = useRef<Map<string, { nickname: string; avatar_emoji: string }>>(
    new Map()
  );
  const readWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubscribedRef = useRef(false);
  const isCurrentlyTypingRef = useRef(false);
  const lastTrackedTypingRef = useRef<boolean | null>(null);
  const presenceSyncCounterRef = useRef(0);

  const hydrateReactions = useCallback(
    async (formatted: Message[]) => {
      if (formatted.length === 0) return formatted;

      const msgIds = formatted.map((m) => m.id).filter((id) => !id.startsWith("local-"));
      if (msgIds.length === 0) return formatted;

      const { data: reactionsData } = await supabase
        .from("message_reactions")
        .select("message_id, profile_id, emoji")
        .in("message_id", msgIds);

      if (!reactionsData) return formatted;

      const reactionsByMessage = new Map<string, { [emoji: string]: string[] }>();
      (reactionsData as ReactionRow[]).forEach((reaction) => {
        const reactionsMap = reactionsByMessage.get(reaction.message_id) || {};
        if (!reactionsMap[reaction.emoji]) reactionsMap[reaction.emoji] = [];
        reactionsMap[reaction.emoji].push(reaction.profile_id);
        reactionsByMessage.set(reaction.message_id, reactionsMap);
      });

      return formatted.map((msg) => ({
        ...msg,
        reactions: reactionsByMessage.get(msg.id) || {},
      }));
    },
    [supabase]
  );

  // Updates Zustand and localDB synchronously
  const syncLocalRoomMessages = useCallback(async () => {
    console.log("syncLocalRoomMessages starting query in IndexedDB for room:", roomId);
    const local = await localDB.messages
      .where("room_id")
      .equals(roomId)
      .reverse()
      .limit(PAGE_SIZE)
      .toArray();

    // Sort descending to keep newest first (compat with ChatRoomClient.reverse())
    const sorted = local.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    console.log("syncLocalRoomMessages complete, found records:", sorted.length);
    useChatHistoryStore.getState().setHotMessages(roomId, sorted);
    return sorted;
  }, [roomId]);

  // Delta Sync: Fetches and merges updates in the background
  const runBackgroundDeltaSync = useCallback(async (latestLocalTimestamp: string | null) => {
    console.log("runBackgroundDeltaSync starting, latestLocalTimestamp:", latestLocalTimestamp);
    try {
      let query = supabase
        .from("messages")
        .select(`*, profiles (nickname, avatar_emoji)`)
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (latestLocalTimestamp) {
        query = query.gt("created_at", latestLocalTimestamp);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log("runBackgroundDeltaSync query success, records returned:", data?.length);
      if (data && data.length > 0) {
        const formatted = await hydrateReactions(data.map(formatMessage));
        
        // Write to local IndexedDB
        await localDB.transaction('rw', localDB.messages, async () => {
          for (const msg of formatted) {
            const mappedLocal: LocalMessage = {
              id: msg.id,
              room_id: msg.room_id,
              sender_id: msg.sender_id,
              sender_nickname: msg.sender_nickname || "Anonymous Student",
              sender_avatar: msg.sender_avatar || "👤",
              content: msg.content,
              type: msg.type,
              media_url: msg.media_url,
              created_at: msg.created_at,
              delivery_status: "sent",
              reply_to_message_id: msg.reply_to_message_id,
              reply_to_content: msg.reply_to_content,
              reply_to_sender_nickname: msg.reply_to_sender_nickname,
              has_media: msg.type === "image" ? 1 : 0,
              reactions: msg.reactions
            };
            await localDB.messages.put(mappedLocal);
          }
        });

        await syncLocalRoomMessages();
      }
    } catch (err) {
      console.warn("Background delta sync failed:", err);
    }
  }, [hydrateReactions, roomId, supabase, syncLocalRoomMessages]);

  const fetchMessages = useCallback(
    async (cursor?: { created_at: string; id: string }) => {
      console.log("fetchMessages called, cursor:", cursor);


      try {
        if (cursor) {
          setLoadingOlder(true);
          setOlderLoadError(null);
        }

        // 1. Initial Load: Load from local DB instantly (0ms)
        if (!cursor) {
          const local = await syncLocalRoomMessages();
          setLoading(false);
          
          // Trigger silent background delta sync based on latest cached timestamp (index 0 is newest in descending sort)
          const latestTimestamp = local.length > 0 ? local[0].created_at : null;
          runBackgroundDeltaSync(latestTimestamp);
          return local.length;
        }

        // 2. Paginated Load (Scrolling Up): Check local IndexedDB first
        const olderLocal = await localDB.messages
          .where('[room_id+created_at]')
          .between([roomId, Dexie.minKey], [roomId, cursor.created_at])
          .reverse()
          .offset(1) // Avoid capturing the cursor message itself
          .limit(PAGE_SIZE)
          .toArray();

        if (olderLocal.length > 0) {
          // Sort descending (newest first)
          const sortedOlder = olderLocal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          // Merge: currentHot (newest) first, then sortedOlder (older)
          const currentHot = useChatHistoryStore.getState().hotCache[roomId] || [];
          useChatHistoryStore.getState().setHotMessages(roomId, [...currentHot, ...sortedOlder]);
          
          setLoadingOlder(false);
          setHasMore(olderLocal.length === PAGE_SIZE);
          return olderLocal.length;
        }

        // 3. Fallback to Supabase for historical/cold messages
        let query = supabase
          .from("messages")
          .select(`*, profiles (nickname, avatar_emoji)`)
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);

        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        );

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          const formatted = await hydrateReactions(data.map(formatMessage));
          
          // Cache only recent text index if desired, but store cold history volatilely in Zustand (already descending)
          useChatHistoryStore.getState().appendColdHistory(roomId, formatted);
          
          setHasMore(formatted.length === PAGE_SIZE);
          setLoadingOlder(false);
          return formatted.length;
        }

        setHasMore(false);
        setLoadingOlder(false);
        return 0;
      } catch (err: unknown) {
        console.error("Error loading chat messages:", getErrorContext(err));
        if (cursor) setOlderLoadError("Could not load older messages.");
        return 0;
      } finally {
        setLoading(false);
        setLoadingOlder(false);
      }
    },
    [roomId, runBackgroundDeltaSync, supabase, syncLocalRoomMessages]
  );

  useEffect(() => {
    console.log("useChat useEffect mounting channel subscription for room:", roomId);

    const initialFetchTimer = setTimeout(() => {
      console.log("useChat initialFetchTimer firing");
      fetchMessages();
    }, 0);

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: currentUserId },
      },
    });

    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: any) => {
          const typedPayload = payload as unknown as RealtimeMessageInsertPayload;
          const newMsg = typedPayload.new;
          let profile = profileCacheRef.current.get(newMsg.sender_id);

          if (!profile) {
            const { data } = await supabase
              .from("profiles")
              .select("nickname, avatar_emoji")
              .eq("id", newMsg.sender_id)
              .maybeSingle();

            profile = {
              nickname: data?.nickname || "Anonymous Student",
              avatar_emoji: data?.avatar_emoji || "👤",
            };
            profileCacheRef.current.set(newMsg.sender_id, profile);
          }

          const formattedMsg: Message = {
            id: newMsg.id,
            room_id: newMsg.room_id,
            sender_id: newMsg.sender_id,
            sender_nickname:
              newMsg.sender_id === currentUserId ? "Me" : profile.nickname,
            sender_avatar: profile.avatar_emoji,
            content: newMsg.content,
            type: newMsg.type,
            media_url: newMsg.media_url || undefined,
            created_at: newMsg.created_at,
            client_message_id: newMsg.client_message_id || undefined,
            reply_to_message_id: newMsg.reply_to_message_id || undefined,
            reply_to_content: newMsg.reply_to_content || undefined,
            reply_to_sender_nickname: newMsg.reply_to_sender_nickname || undefined,
            reactions: {},
            delivery_status: "sent",
          };

          // Save new realtime insert message to IndexedDB
          const mappedLocal: LocalMessage = {
            id: formattedMsg.id,
            room_id: formattedMsg.room_id,
            sender_id: formattedMsg.sender_id,
            sender_nickname: formattedMsg.sender_nickname || "Anonymous Student",
            sender_avatar: formattedMsg.sender_avatar || "👤",
            content: formattedMsg.content,
            type: formattedMsg.type,
            media_url: formattedMsg.media_url,
            created_at: formattedMsg.created_at,
            delivery_status: "sent",
            reply_to_message_id: formattedMsg.reply_to_message_id,
            reply_to_content: formattedMsg.reply_to_content,
            reply_to_sender_nickname: formattedMsg.reply_to_sender_nickname,
            has_media: formattedMsg.type === "image" ? 1 : 0,
            reactions: {}
          };

          await localDB.messages.put(mappedLocal);
          await syncLocalRoomMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        async (payload: any) => {
          const typedPayload = payload as unknown as RealtimeReactionPayload;
          const reaction = typedPayload.new || typedPayload.old;
          if (!reaction || !reaction.message_id || typeof reaction.message_id !== "string") {
            console.warn("Realtime reaction payload missing message_id or invalid:", reaction);
            return;
          }

          const msg = await localDB.messages.get(reaction.message_id);
          if (msg) {
            const currentReactions = { ...(msg.reactions || {}) };

            if (typedPayload.eventType === "INSERT") {
              if (!currentReactions[reaction.emoji]) {
                currentReactions[reaction.emoji] = [];
              }
              if (!currentReactions[reaction.emoji].includes(reaction.profile_id)) {
                currentReactions[reaction.emoji].push(reaction.profile_id);
              }
              await localDB.messages.update(reaction.message_id, { reactions: currentReactions });
              await syncLocalRoomMessages();
            } else if (typedPayload.eventType === "DELETE") {
              const { data } = await supabase
                .from("message_reactions")
                .select("profile_id, emoji")
                .eq("message_id", reaction.message_id);

              const updatedMap: { [emoji: string]: string[] } = {};
              if (data) {
                (data as { profile_id: string; emoji: string }[]).forEach((r) => {
                  if (!updatedMap[r.emoji]) updatedMap[r.emoji] = [];
                  updatedMap[r.emoji].push(r.profile_id);
                });
              }
              await localDB.messages.update(reaction.message_id, { reactions: updatedMap });
              await syncLocalRoomMessages();
            }
          }
        }
      )
      .on("presence", { event: "sync" }, async () => {
        const syncId = ++presenceSyncCounterRef.current;
        const state = channel.presenceState();
        
        // 1. Identify who is currently typing
        const typingUserIds: string[] = [];
        for (const key of Object.keys(state)) {
          if (key === currentUserId) continue;
          const userPresences = state[key] as TypingPresence[];
          if (userPresences.some((p) => p.typing)) {
            typingUserIds.push(key);
          }
        }

        if (typingUserIds.length === 0) {
          setTypingUsers([]);
          return;
        }

        // 2. Fetch missing profiles in parallel instead of sequentially in a loop
        const missingUserIds = typingUserIds.filter(id => !profileCacheRef.current.has(id));
        
        if (missingUserIds.length > 0) {
          try {
            const { data } = await supabase
              .from("profiles")
              .select("id, nickname, avatar_emoji")
              .in("id", missingUserIds);

            if (data) {
              data.forEach((p: any) => {
                profileCacheRef.current.set(p.id, {
                  nickname: p.nickname,
                  avatar_emoji: p.avatar_emoji
                });
              });
            }
          } catch (err) {
            console.error("Failed to fetch typing user profiles:", err);
          }
        }

        // 3. Check if a newer sync event has fired in the meantime to avoid race conditions
        if (syncId !== presenceSyncCounterRef.current) {
          console.log("Discarding stale presence sync event:", syncId);
          return;
        }

        // 4. Map typing users to their profiles and update state
        const mappedUsers: TypingUser[] = typingUserIds.map(id => {
          const profile = profileCacheRef.current.get(id);
          return {
            id,
            nickname: profile?.nickname || "Anonymous Student",
            avatar_emoji: profile?.avatar_emoji || "👤"
          };
        });

        setTypingUsers(mappedUsers);
      })
      .subscribe((status: string) => {
        console.log(`useChat channel subscription status for room ${roomId}:`, status);
        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
          const currentTypingVal = isCurrentlyTypingRef.current;
          lastTrackedTypingRef.current = currentTypingVal;
          channel.track({ typing: currentTypingVal });
        } else {
          isSubscribedRef.current = false;
          lastTrackedTypingRef.current = null;
        }
      });

    return () => {
      console.log("useChat useEffect subscribe cleaning up for room:", roomId);
      isSubscribedRef.current = false;
      lastTrackedTypingRef.current = null;
      clearTimeout(initialFetchTimer);
      if (readWriteTimerRef.current) clearTimeout(readWriteTimerRef.current);
      supabase.removeChannel(channel);
      
      // Wipe volatile memory (coldHistory) on exit to release RAM
      useChatHistoryStore.getState().clearColdHistory(roomId);
    };
  }, [currentUserId, fetchMessages, roomId, supabase, syncLocalRoomMessages]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingOlder || messages.length === 0) return 0;
    const oldest = messages[0]; // Messages sorted oldest first in display lists
    return fetchMessages({ created_at: oldest.created_at, id: oldest.id });
  }, [fetchMessages, hasMore, loading, loadingOlder, messages]);

  const sendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}) => {
      const trimmed = content.trim();
      const isImage = options.type === "image";
      if (!trimmed && !isImage) return;

      const finalContent = isImage ? (trimmed || "Photo") : trimmed;
      const replyTo = options.replyTo || null;



      const clientMessageId = options.retryClientMessageId || crypto.randomUUID();
      
      // Mapped IndexedDB optimistic insertion
      const localOptimistic: LocalMessage = {
        id: clientMessageId, // Stored by clientMessageId temporarily
        room_id: roomId,
        sender_id: currentUserId,
        sender_nickname: "Me",
        sender_avatar: "👤",
        content: finalContent,
        type: options.type || "text",
        media_url: options.mediaUrl,
        created_at: new Date().toISOString(),
        delivery_status: "sending",
        reply_to_message_id: replyTo?.messageId || undefined,
        reply_to_content: replyTo?.content || undefined,
        reply_to_sender_nickname: replyTo?.senderNickname || undefined,
        has_media: isImage ? 1 : 0,
        media_metadata: isImage ? {
          width: options.width,
          height: options.height,
          aspect_ratio: options.aspectRatio,
          blurhash: options.blurhash,
          upload_state: 'pending'
        } : undefined
      };

      await localDB.messages.put(localOptimistic);
      await syncLocalRoomMessages();

      let { data, error } = await supabase
        .from("messages")
        .insert({
          room_id: roomId,
          sender_id: currentUserId,
          content: finalContent,
          type: options.type || "text",
          media_url: options.mediaUrl || null,
          client_message_id: clientMessageId,
          reply_to_message_id: replyTo?.messageId,
          reply_to_content: replyTo?.content,
          reply_to_sender_nickname: replyTo?.senderNickname,
        })
        .select(`*, profiles (nickname, avatar_emoji)`)
        .maybeSingle();

      if (error && shouldRetryWithoutClientMessageId(error)) {
        const fallbackResult = await supabase
          .from("messages")
          .insert({
            room_id: roomId,
            sender_id: currentUserId,
            content: finalContent,
            type: options.type || "text",
            media_url: options.mediaUrl || null,
          })
          .select(`*, profiles (nickname, avatar_emoji)`)
          .maybeSingle();

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error("Send message error:", getErrorContext(error));
        await localDB.messages.update(clientMessageId, {
          delivery_status: "failed"
        });
        if (isImage && localOptimistic.media_metadata) {
          await localDB.messages.update(clientMessageId, {
            media_metadata: {
              ...localOptimistic.media_metadata,
              upload_state: 'failed'
            }
          });
        }
        await syncLocalRoomMessages();
        return;
      }

      if (data) {
        // Remove optimistic record by temporary client ID and write final record
        await localDB.messages.delete(clientMessageId);
        
        const confirmedMessage: LocalMessage = {
          id: data.id,
          room_id: data.room_id,
          sender_id: data.sender_id,
          sender_nickname: "Me",
          sender_avatar: "👤",
          content: data.content,
          type: data.type,
          media_url: data.media_url || undefined,
          created_at: data.created_at,
          delivery_status: "sent",
          reply_to_message_id: data.reply_to_message_id || undefined,
          reply_to_content: data.reply_to_content || undefined,
          reply_to_sender_nickname: data.reply_to_sender_nickname || undefined,
          has_media: data.type === "image" ? 1 : 0,
          media_metadata: isImage ? {
            width: options.width,
            height: options.height,
            aspect_ratio: options.aspectRatio,
            blurhash: options.blurhash,
            upload_state: 'success',
            access_count: 0
          } : undefined
        };

        await localDB.messages.put(confirmedMessage);
        await syncLocalRoomMessages();
      }
    },
    [currentUserId, roomId, supabase, syncLocalRoomMessages]
  );

  const retryMessage = useCallback(
    async (clientMessageId: string) => {
      const failedMessage = messages.find(
        (msg) => msg.client_message_id === clientMessageId && msg.delivery_status === "failed"
      );
      if (!failedMessage) return;

      await localDB.messages.update(clientMessageId, {
        delivery_status: "sending"
      });
      await syncLocalRoomMessages();

      await sendMessage(failedMessage.content, {
        retryClientMessageId: clientMessageId,
        replyTo: failedMessage.reply_to_message_id
          ? {
              messageId: failedMessage.reply_to_message_id,
              content: failedMessage.reply_to_content || "",
              senderNickname:
                failedMessage.reply_to_sender_nickname || "Anonymous Student",
            }
          : null,
      });
    },
    [messages, sendMessage, syncLocalRoomMessages]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const targetMsg = messages.find((m) => m.id === messageId);
      if (!targetMsg || targetMsg.id.startsWith("local-")) return;



      const userAlreadyReacted = targetMsg.reactions?.[emoji]?.includes(currentUserId);

      if (userAlreadyReacted) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("profile_id", currentUserId)
          .eq("emoji", emoji);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          profile_id: currentUserId,
          emoji,
        });
      }
    },
    [currentUserId, messages, roomId, supabase]
  );

  const setTypingStatus = useCallback((isTyping: boolean) => {
    isCurrentlyTypingRef.current = isTyping;
    if (isSubscribedRef.current && channelRef.current) {
      if (lastTrackedTypingRef.current !== isTyping) {
        lastTrackedTypingRef.current = isTyping;
        console.log("Tracking typing status via WebSocket:", isTyping);
        channelRef.current.track({ typing: isTyping });
      }
    }
  }, []);

  const markRoomRead = useCallback(() => {
    if (readWriteTimerRef.current) clearTimeout(readWriteTimerRef.current);

    readWriteTimerRef.current = setTimeout(() => {
      supabase
        .from("room_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("profile_id", currentUserId)
        .then((res: any) => {
          if (res.error) {
            console.error("Failed to update read state:", res.error);
          }
        });
    }, 450);
  }, [currentUserId, roomId, supabase]);

  // Auto-sync missed messages when tab becomes visible or window gains focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("useChat visibility changed to visible: triggering delta sync and reconnecting realtime");
        // Reconnect the realtime connection immediately
        supabase.realtime.connect();
        
        // Get the latest message timestamp we have in memory or IndexedDB
        syncLocalRoomMessages().then((local) => {
          const latestTimestamp = local.length > 0 ? local[0].created_at : null;
          runBackgroundDeltaSync(latestTimestamp);
        });
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [runBackgroundDeltaSync, supabase.realtime, syncLocalRoomMessages]);


  return {
    messages,
    loading,
    loadingOlder,
    olderLoadError,
    typingUsers,
    hasMore,
    loadMore,
    sendMessage,
    retryMessage,
    toggleReaction,
    setTypingStatus,
    markRoomRead,
  };
}
