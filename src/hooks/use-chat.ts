"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
}

export type ReplyDraft = {
  messageId: string;
  content: string;
  senderNickname: string;
};

type SendMessageOptions = {
  retryClientMessageId?: string;
  replyTo?: ReplyDraft | null;
  type?: "text" | "image";
  mediaUrl?: string;
};

type MessageCursor = {
  created_at: string;
  id: string;
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

function isMockRoom(roomId: string) {
  return roomId.startsWith("mock-");
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
  };
}

function mergeMessageLists(prev: Message[], incoming: Message[]) {
  const byKey = new Map<string, Message>();

  [...prev, ...incoming].forEach((msg) => {
    const key = msg.client_message_id
      ? `client:${msg.sender_id}:${msg.client_message_id}`
      : `id:${msg.id}`;
    const existing = byKey.get(key);

    byKey.set(key, {
      ...existing,
      ...msg,
      reactions: msg.reactions || existing?.reactions || {},
      delivery_status:
        msg.delivery_status === "failed"
          ? "failed"
          : msg.delivery_status || existing?.delivery_status || "sent",
    });
  });

  const byServerId = new Map<string, Message>();
  Array.from(byKey.values()).forEach((msg) => {
    const existing = byServerId.get(msg.id);
    if (!existing || (!existing.client_message_id && msg.client_message_id)) {
      byServerId.set(msg.id, msg);
    }
  });

  return Array.from(byServerId.values()).sort((a, b) => {
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
}

export function useChat(roomId: string, currentUserId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderLoadError, setOlderLoadError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const channelRef = useRef<{ track: (payload: { typing: boolean }) => unknown } | null>(null);
  const profileCacheRef = useRef<Map<string, { nickname: string; avatar_emoji: string }>>(
    new Map()
  );
  const readWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      reactionsData.forEach((reaction) => {
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

  const fetchMessages = useCallback(
    async (cursor?: MessageCursor) => {
      if (isMockRoom(roomId)) {
        setLoading(false);
        setHasMore(false);
        return 0;
      }

      try {
        if (cursor) {
          setLoadingOlder(true);
          setOlderLoadError(null);
        }

        let query = supabase
          .from("messages")
          .select(
            `
              *,
              profiles (
                nickname,
                avatar_emoji
              )
            `
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);

        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
          );
        }

        const { data, error } = await query;

        if (error) throw error;

        const formatted = await hydrateReactions((data || []).map(formatMessage));

        setHasMore(formatted.length === PAGE_SIZE);
        setMessages((prev) => (cursor ? mergeMessageLists(prev, formatted) : formatted));

        return formatted.length;
      } catch (err: unknown) {
        console.error("Error loading chat messages:", getErrorContext(err));
        if (cursor) setOlderLoadError("Could not load older messages.");
        return 0;
      } finally {
        setLoading(false);
        setLoadingOlder(false);
      }
    },
    [hydrateReactions, roomId, supabase]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setMessages([]);
      setLoading(true);
      setHasMore(true);
      setOlderLoadError(null);
    });

    if (isMockRoom(roomId)) {
      queueMicrotask(() => {
        setLoading(false);
        setHasMore(false);
      });

      if (roomId === "mock-dm-techiegeek") {
        queueMicrotask(() => {
          setMessages([
            {
              id: "mock-msg-2",
              room_id: roomId,
              sender_id: currentUserId,
              sender_nickname: "Me",
              sender_avatar: "👤",
              content: "I think they serve it on Tuesdays and Thursdays!",
              type: "text",
              created_at: new Date(Date.now() - 1800000).toISOString(),
              reactions: {},
              delivery_status: "sent",
            },
            {
              id: "mock-msg-1",
              room_id: roomId,
              sender_id: "peer-techie",
              sender_nickname: "TechieGeek",
              sender_avatar: "🤖",
              content: "Anyone know if the library cafeteria is serving biryani?",
              type: "text",
              created_at: new Date(Date.now() - 3600000).toISOString(),
              reactions: { "🔥": ["peer-techie"] },
              delivery_status: "sent",
            },
          ]);
        });
      } else if (roomId === "mock-dm-ecowarrior") {
        queueMicrotask(() => {
          setMessages([
            {
              id: "mock-msg-3",
              room_id: roomId,
              sender_id: "peer-eco",
              sender_nickname: "EcoWarrior",
              sender_avatar: "🌱",
              content: "Just grabbed this! The queue is huge but totally worth it.",
              type: "text",
              created_at: new Date(Date.now() - 3600000).toISOString(),
              reactions: { "❤️": ["peer-eco"] },
              delivery_status: "sent",
            },
          ]);
        });
      }
      return;
    }

    const initialFetchTimer = setTimeout(() => {
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
        async (payload) => {
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

          setMessages((prev) => mergeMessageLists(prev, [formattedMsg]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const typedPayload = payload as unknown as RealtimeReactionPayload;
          const reaction = typedPayload.new || typedPayload.old;
          if (!reaction) return;

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== reaction.message_id) return msg;

              const currentReactions = { ...(msg.reactions || {}) };

              if (typedPayload.eventType === "INSERT") {
                if (!currentReactions[reaction.emoji]) {
                  currentReactions[reaction.emoji] = [];
                }
                if (!currentReactions[reaction.emoji].includes(reaction.profile_id)) {
                  currentReactions[reaction.emoji].push(reaction.profile_id);
                }
              } else if (typedPayload.eventType === "DELETE") {
                supabase
                  .from("message_reactions")
                  .select("profile_id, emoji")
                  .eq("message_id", msg.id)
                  .then(({ data }) => {
                    if (!data) return;

                    const updatedMap: { [emoji: string]: string[] } = {};
                    data.forEach((r) => {
                      if (!updatedMap[r.emoji]) updatedMap[r.emoji] = [];
                      updatedMap[r.emoji].push(r.profile_id);
                    });

                    setMessages((current) =>
                      current.map((m) =>
                        m.id === msg.id ? { ...m, reactions: updatedMap } : m
                      )
                    );
                  });
              }

              return { ...msg, reactions: currentReactions };
            })
          );
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typingList = new Set<string>();

        Object.keys(state).forEach((key) => {
          const userPresences = state[key] as TypingPresence[];
          userPresences.forEach((presence) => {
            if (presence.typing && key !== currentUserId) {
              typingList.add(key);
            }
          });
        });

        setTypingUsers(typingList);
      })
      .subscribe();

    return () => {
      clearTimeout(initialFetchTimer);
      if (readWriteTimerRef.current) clearTimeout(readWriteTimerRef.current);
      channel.unsubscribe();
    };
  }, [currentUserId, fetchMessages, roomId, supabase]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingOlder || messages.length === 0) return 0;

    const oldest = messages[messages.length - 1];
    return fetchMessages({ created_at: oldest.created_at, id: oldest.id });
  }, [fetchMessages, hasMore, loading, loadingOlder, messages]);

  const sendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}) => {
      const trimmed = content.trim();
      const isImage = options.type === "image";
      if (!trimmed && !isImage) return;

      const finalContent = isImage ? (trimmed || "Photo") : trimmed;
      const replyTo = options.replyTo || null;

      if (isMockRoom(roomId)) {
        const newMsg: Message = {
          id: options.retryClientMessageId || `mock-sent-${Date.now()}`,
          room_id: roomId,
          sender_id: currentUserId,
          sender_nickname: "Me",
          sender_avatar: "👤",
          content: finalContent,
          type: options.type || "text",
          media_url: options.mediaUrl,
          created_at: new Date().toISOString(),
          reactions: {},
          delivery_status: "sent",
          reply_to_message_id: replyTo?.messageId,
          reply_to_content: replyTo?.content,
          reply_to_sender_nickname: replyTo?.senderNickname,
        };
        setMessages((prev) => mergeMessageLists(prev, [newMsg]));
        return;
      }

      const clientMessageId = options.retryClientMessageId || crypto.randomUUID();
      const optimisticMessage: Message = {
        id: `local-${clientMessageId}`,
        room_id: roomId,
        sender_id: currentUserId,
        sender_nickname: "Me",
        sender_avatar: "👤",
        content: finalContent,
        type: options.type || "text",
        media_url: options.mediaUrl,
        created_at: new Date().toISOString(),
        reactions: {},
        client_message_id: clientMessageId,
        reply_to_message_id: replyTo?.messageId,
        reply_to_content: replyTo?.content,
        reply_to_sender_nickname: replyTo?.senderNickname,
        delivery_status: "sending",
      };

      setMessages((prev) => mergeMessageLists(prev, [optimisticMessage]));

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
        .select(
          `
            *,
            profiles (
              nickname,
              avatar_emoji
            )
          `
        )
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
          .select(
            `
              *,
              profiles (
                nickname,
                avatar_emoji
              )
            `
          )
          .maybeSingle();

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error("Send message error:", getErrorContext(error));

        setMessages((prev) =>
          prev.map((msg) =>
            msg.client_message_id === clientMessageId
              ? {
                  ...msg,
                  delivery_status: "failed",
                  error_message: "Could not send. Tap retry.",
                }
              : msg
          )
        );
        return;
      }

      if (data) {
        const confirmedMessage = {
          ...formatMessage(data),
          client_message_id: data.client_message_id || clientMessageId,
          reply_to_message_id: data.reply_to_message_id || replyTo?.messageId,
          reply_to_content: data.reply_to_content || replyTo?.content,
          reply_to_sender_nickname:
            data.reply_to_sender_nickname || replyTo?.senderNickname,
        };
        setMessages((prev) => mergeMessageLists(prev, [confirmedMessage]));
      }
    },
    [currentUserId, roomId, supabase]
  );

  const retryMessage = useCallback(
    async (clientMessageId: string) => {
      const failedMessage = messages.find(
        (msg) => msg.client_message_id === clientMessageId && msg.delivery_status === "failed"
      );
      if (!failedMessage) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.client_message_id === clientMessageId
            ? { ...msg, delivery_status: "sending", error_message: undefined }
            : msg
        )
      );

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
    [messages, sendMessage]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const targetMsg = messages.find((m) => m.id === messageId);
      if (!targetMsg || targetMsg.id.startsWith("local-")) return;

      if (isMockRoom(roomId)) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId) return msg;
            const currentReactions = { ...(msg.reactions || {}) };
            if (!currentReactions[emoji]) {
              currentReactions[emoji] = [];
            }
            if (currentReactions[emoji].includes(currentUserId)) {
              currentReactions[emoji] = currentReactions[emoji].filter(
                (id) => id !== currentUserId
              );
            } else {
              currentReactions[emoji].push(currentUserId);
            }
            return { ...msg, reactions: currentReactions };
          })
        );
        return;
      }

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
    if (isMockRoom(roomId)) return;
    channelRef.current?.track({ typing: isTyping });
  }, [roomId]);

  const markRoomRead = useCallback(() => {
    if (isMockRoom(roomId)) return;
    if (readWriteTimerRef.current) clearTimeout(readWriteTimerRef.current);

    readWriteTimerRef.current = setTimeout(() => {
      supabase
        .from("room_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("profile_id", currentUserId)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to update read state:", error);
          }
        });
    }, 450);
  }, [currentUserId, roomId, supabase]);

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
