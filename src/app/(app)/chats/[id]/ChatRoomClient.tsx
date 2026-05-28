"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect as reactUseLayoutEffect, useMemo, useRef, useState } from "react";

const useLayoutEffect = typeof window !== "undefined" ? reactUseLayoutEffect : useEffect;
import { useRouter } from "next/navigation";
import { Message, ReplyDraft, useChat } from "@/hooks/use-chat";
import { createClient } from "@/lib/supabase/client";
import { submitSafetyReport } from "@/app/actions/report";
import { useInboxStore, type InboxState } from "@/hooks/use-inbox-store";
import ImageEditorModal from "@/components/common/ImageEditorModal";
import { optimizeAndStripImage } from "@/lib/utils/media";
import { getPresignedUploadUrl } from "@/app/actions/media";
import { resolveDirectMessageRoom } from "@/app/actions/chats";
import MessageComposer from "@/components/common/MessageComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { localDB } from "@/lib/db/local-db";
import { ImageViewerModal } from "@/components/chat/ImageViewerModal";

interface ChatRoomClientProps {
  roomId: string;
  initialRoomData?: {
    name: string;
    avatar_emoji: string;
    type: "direct" | "group";
  };
  currentUserId: string;
}

type SwipeState = {
  messageId: string;
  startX: number;
  startY: number;
  offset: number;
};

const POPULAR_EMOJIS = [
  "😂", "❤️", "👍", "🔥", "😍", "😭", "😊", "🙏",
  "🤔", "💀", "🤣", "🥺", "👀", "😮", "👏", "🎉",
  "🥳", "💯", "🤫", "🤡", "🫠", "🧐", "😎", "🙄",
  "😢", "😡", "💩", "💡", "📌", "🚀", "✨", "📱"
];
const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

const isEmojiOnly = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /^[\p{Extended_Pictographic}\s\u200d\ufe0f]+$/u.test(trimmed);
};

function getReplyDraft(message: Message, currentUserId: string): ReplyDraft {
  return {
    messageId: message.id,
    content: message.type === "image" ? "Photo" : message.content,
    senderNickname:
      message.sender_id === currentUserId
        ? "You"
        : message.sender_nickname || "Anonymous Student",
  };
}

export default function ChatRoomClient({
  roomId,
  initialRoomData,
  currentUserId,
}: ChatRoomClientProps) {
  const router = useRouter();
  
  // Use scoped selector for patchRoom so updates to inbox rooms list do not trigger re-renders here
  const patchRoom = useInboxStore(useCallback((state: InboxState) => state.patchRoom, []));
  
  const [roomData, setRoomData] = useState<{
    name: string;
    avatar_emoji: string;
    type: "direct" | "group";
    pinned_message_id?: string | null;
  }>(initialRoomData || {
    name: "Anonymous Room",
    avatar_emoji: "💬",
    type: "group",
    pinned_message_id: null,
  });

  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);

  const [showOptions, setShowOptions] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyDraft | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [copyToast, setCopyToast] = useState("");
  const [swipeState, setSwipeState] = useState<SwipeState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [selectedPeerProfile, setSelectedPeerProfile] = useState<{ id: string; nickname: string; avatar_emoji: string } | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Local-first client hydration for room metadata
  useEffect(() => {
    const resolveRoomDetails = async () => {
      // 1. Try checking local IndexedDB first
      const local = await localDB.rooms.get(roomId);
      if (local) {
        setRoomData({
          name: local.name,
          avatar_emoji: local.avatar_emoji,
          type: local.type,
          pinned_message_id: local.pinned_message_id || null,
        });
        if (!initialScrollDoneRef.current) {
          const count = local.unread_count || 0;
          initialUnreadCountRef.current = count;
          scrollAnchorRef.current = count > 0 ? "unread" : "bottom";
          console.log("[Veilo Scroll] Set anchor:", scrollAnchorRef.current, "unread count:", count);
        }
        return;
      }

      // 2. Fallback to Supabase lookup client-side
      if (roomId === "00000000-0000-0000-0000-000000000000") {
        const globalDetails = {
          name: "Global AMU Chat",
          avatar_emoji: "🎓",
          type: "group" as const,
          pinned_message_id: null,
        };
        setRoomData(globalDetails);
        await localDB.rooms.put({
          id: roomId,
          name: globalDetails.name,
          avatar_emoji: globalDetails.avatar_emoji,
          type: globalDetails.type,
          last_message: "Tap to start chatting...",
          last_message_at: null,
          last_opened_at: Date.now(),
          unread_count: 0,
          is_muted: 0,
          pinned_message_id: null,
        });
        return;
      }

      const supabase = createClient();
      const { data: dbRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (dbRoom) {
        let rName = dbRoom.name || "Anonymous Chat";
        let rAvatar = dbRoom.avatar_emoji || "💬";
        let rPinned = dbRoom.pinned_message_id || null;

        if (dbRoom.type === "direct") {
          const { data: peer } = await supabase
            .from("room_participants")
            .select("profile_id")
            .eq("room_id", roomId)
            .neq("profile_id", currentUserId)
            .maybeSingle();

          if (peer?.profile_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nickname, avatar_emoji")
              .eq("id", peer.profile_id)
              .maybeSingle();

            if (profile) {
              rName = profile.nickname;
              rAvatar = profile.avatar_emoji;
            }
          }
        }

        const fetchedData = { name: rName, avatar_emoji: rAvatar, type: dbRoom.type, pinned_message_id: rPinned };
        setRoomData(fetchedData);
        
        await localDB.rooms.put({
          id: roomId,
          name: rName,
          avatar_emoji: rAvatar,
          type: dbRoom.type,
          last_message: "Tap to start chatting...",
          last_message_at: null,
          last_opened_at: Date.now(),
          unread_count: 0,
          is_muted: 0,
          pinned_message_id: rPinned,
        });
      }
    };

    resolveRoomDetails();
  }, [roomId, currentUserId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const olderMessagesRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const previousNewestMessageIdRef = useRef<string | null>(null);
  const suppressNextClickRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUnreadCountRef = useRef<number>(0);
  const scrollAnchorRef = useRef<"bottom" | "unread" | null>("bottom");
  const lastScrollHeightRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000); // Show toast for 4 seconds
    return () => clearTimeout(timer);
  }, [toast]);

  const {
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
    deleteMessage,
    pinMessage,
  } = useChat(roomId, currentUserId);

  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const newestMessage = messages[0];
  const selectedIsMine = selectedMessage?.sender_id === currentUserId;

  // Realtime subscription for room settings (e.g. pinned_message_id updates)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room-meta:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        async (payload: any) => {
          const newRoom = payload.new;
          if (newRoom) {
            console.log("Realtime room update received:", newRoom);
            setRoomData((prev) => ({
              ...prev,
              pinned_message_id: newRoom.pinned_message_id || null,
            }));
            
            // Also update IndexedDB
            const local = await localDB.rooms.get(roomId);
            if (local) {
              await localDB.rooms.update(roomId, {
                pinned_message_id: newRoom.pinned_message_id || null,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Resolve pinned message details dynamically when pinned_message_id is active
  useEffect(() => {
    const resolvePinnedMessage = async () => {
      const pinId = roomData.pinned_message_id;
      if (!pinId) {
        setPinnedMessage(null);
        return;
      }

      // Check current in-memory messages first
      const foundInMemory = messages.find((m) => m.id === pinId);
      if (foundInMemory) {
        setPinnedMessage(foundInMemory);
        return;
      }

      // Check local DB
      const localMsg = await localDB.messages.get(pinId);
      if (localMsg) {
        setPinnedMessage({
          id: localMsg.id,
          room_id: localMsg.room_id,
          sender_id: localMsg.sender_id,
          sender_nickname: localMsg.sender_nickname,
          sender_avatar: localMsg.sender_avatar,
          content: localMsg.content,
          type: localMsg.type,
          media_url: localMsg.media_url,
          created_at: localMsg.created_at,
          reactions: localMsg.reactions,
          client_message_id: undefined,
          delivery_status: "sent",
        });
        return;
      }

      // Fetch from Supabase
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select(`*, profiles (nickname, avatar_emoji)`)
        .eq("id", pinId)
        .maybeSingle();

      if (data) {
        const formatted = {
          id: data.id,
          room_id: data.room_id,
          sender_id: data.sender_id,
          sender_nickname: data.profiles?.nickname || "Anonymous Student",
          sender_avatar: data.profiles?.avatar_emoji || "👤",
          content: data.content,
          type: data.type,
          media_url: data.media_url || undefined,
          created_at: data.created_at,
          delivery_status: "sent" as const,
        };
        setPinnedMessage(formatted);
      } else {
        setPinnedMessage(null);
      }
    };

    resolvePinnedMessage();
  }, [roomData.pinned_message_id, messages]);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Add a brief premium glow flash animation to the message bubble
      el.classList.add("ring-2", "ring-amber-400/50", "ring-offset-2", "ring-offset-[#08080C]", "scale-[1.02]", "transition-all", "duration-500");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber-400/50", "ring-offset-2", "ring-offset-[#08080C]", "scale-[1.02]");
      }, 1500);
    }
  }, []);

  const isNearBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return true;

    return container.scrollHeight - container.scrollTop - container.clientHeight < 140;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const scrollToUnread = useCallback(() => {
    const container = chatContainerRef.current;
    const separator = container?.querySelector('[data-unread-separator="true"]');
    if (separator) {
      separator.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    if (!initialScrollDoneRef.current) return;

    if (scrollAnchorRef.current === "bottom") {
      scrollToBottom("auto");
    } else if (scrollAnchorRef.current === "unread") {
      scrollToUnread();
    }
  }, [scrollToBottom, scrollToUnread]);

  const handleImageClick = useCallback((url: string) => {
    setViewingImageUrl(url);
  }, []);

  useEffect(() => {
    const loadRoomState = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("room_participants")
        .select("is_muted")
        .eq("room_id", roomId)
        .eq("profile_id", currentUserId)
        .maybeSingle();

      setIsMuted(Boolean(data?.is_muted));
    };

    loadRoomState();
  }, [currentUserId, roomId]);

  // Scroll anchoring adjustment when older messages are loaded to prevent layout jitter
  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (lastScrollHeightRef.current > 0) {
      const heightDifference = container.scrollHeight - lastScrollHeightRef.current;
      if (heightDifference > 0) {
        container.scrollTop = lastScrollTopRef.current + heightDifference;
      }
      // Reset refs
      lastScrollHeightRef.current = 0;
      lastScrollTopRef.current = 0;
    }
  }, [messages]);

  // Scroll and read-state rules for a stable chat viewport.
  useEffect(() => {
    if (loading || messages.length === 0) return;

    const newestMessage = messages[0];

    if (!initialScrollDoneRef.current) {
      if (scrollAnchorRef.current === "unread") {
        requestAnimationFrame(() => {
          scrollToUnread();
        });
      } else {
        scrollToBottom("auto");
      }
      initialScrollDoneRef.current = true;
      previousNewestMessageIdRef.current = newestMessage.id;
      markRoomRead();
      return;
    }

    if (previousNewestMessageIdRef.current === newestMessage.id) return;

    const newestIsMine = newestMessage.sender_id === currentUserId;
    const shouldAutoScroll = newestIsMine || isNearBottom();

    if (shouldAutoScroll) {
      scrollToBottom("smooth");
      queueMicrotask(() => setShowNewMessages(false));
      markRoomRead();
    } else {
      queueMicrotask(() => setShowNewMessages(true));
    }

    previousNewestMessageIdRef.current = newestMessage.id;
  }, [currentUserId, isNearBottom, loading, markRoomRead, messages, scrollToBottom]);

  // VisualViewport keyboard handling for mobile (Android/iOS) layout stability
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const viewport = window.visualViewport;
    if (!viewport) return;

    const adjustLayout = () => {
      if (!mainRef.current) return;
      
      const height = viewport.height;
      mainRef.current.style.height = `${height}px`;
      mainRef.current.style.minHeight = `${height}px`;
      
      // On mobile keyboards showing up, prevent double-scrolling of outer window
      window.scrollTo(0, 0);
      
      // If user was near bottom, scroll messages to bottom to follow keyboard shift
      if (isNearBottom()) {
        scrollToBottom("auto");
      }
    };

    // Use passive event listeners to avoid blocking main thread touch/scroll interactions
    viewport.addEventListener("resize", adjustLayout, { passive: true });
    viewport.addEventListener("scroll", adjustLayout, { passive: true });
    
    // Initial sync
    adjustLayout();

    return () => {
      viewport.removeEventListener("resize", adjustLayout);
      viewport.removeEventListener("scroll", adjustLayout);
    };
  }, [isNearBottom, scrollToBottom]);

  // Cancel active long-press or swipe states when user scrolls the message container
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setSwipeState((curr) => {
        if (curr !== null) return null;
        return curr;
      });

      if (initialScrollDoneRef.current) {
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (nearBottom) {
          scrollAnchorRef.current = "bottom";
        } else {
          scrollAnchorRef.current = null;
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Profiling User Timing Metrics
  useEffect(() => {
    if (typeof window !== "undefined" && window.performance && !loading) {
      try {
        if (performance.getEntriesByName("veilo-pointerdown").length > 0) {
          performance.mark("veilo-content-rendered");
          performance.measure(
            "veilo-tap-to-content",
            "veilo-pointerdown",
            "veilo-content-rendered"
          );
          
          const measure = performance.getEntriesByName("veilo-tap-to-content")[0];
          console.log(`[Veilo Performance] Tap-to-content: ${measure.duration.toFixed(2)}ms`);
        }
      } catch (err) {
        console.warn("Performance timing error:", err);
      }
    }
  }, [loading]);

  useEffect(() => {
    if (!newestMessage || newestMessage.type === "system") return;

    const roomPatch = {
      lastMessage: newestMessage.type === "image" ? "Photo" : newestMessage.content,
      lastMessageAt: newestMessage.created_at,
    };

    patchRoom(
      roomId,
      newestMessage.sender_id === currentUserId || isNearBottom()
        ? { ...roomPatch, unreadCount: 0 }
        : roomPatch
    );
  }, [currentUserId, isNearBottom, newestMessage, patchRoom, roomId]);

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      setShowNewMessages(false);
      markRoomRead();
      patchRoom(roomId, { unreadCount: 0 });
    }
  }, [isNearBottom, markRoomRead, patchRoom, roomId]);

  // Update read state when the browser tab becomes active again.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isNearBottom()) {
        markRoomRead();
        patchRoom(roomId, { unreadCount: 0 });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isNearBottom, markRoomRead, patchRoom, roomId]);

  // Auto-load older messages when the top sentinel enters view.
  useEffect(() => {
    const sentinel = olderMessagesRef.current;
    const container = chatContainerRef.current;
    if (!sentinel || !container || !hasMore || loading || loadingOlder) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || loadingOlder) return;

        const previousHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;
        lastScrollHeightRef.current = previousHeight;
        lastScrollTopRef.current = previousScrollTop;

        await loadMore();
      },
      { root: container, rootMargin: "160px 0px 0px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingOlder, messages.length]);

  // Typing state timer
  // Scroll to bottom when someone starts typing to reveal the typing bubbles
  useEffect(() => {
    if (typingUsers.length > 0 && isNearBottom()) {
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
    }
  }, [typingUsers.length, isNearBottom, scrollToBottom]);

  const handlePeerClick = useCallback((id: string, nickname: string, avatar: string) => {
    setSelectedPeerProfile({
      id,
      nickname,
      avatar_emoji: avatar,
    });
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, message: Message) => {
    event.preventDefault();
    setSelectedMessage(message);
  }, []);

  // Handle message send
  const handleSendMessage = useCallback((text: string) => {
    sendMessage(text, { replyTo: replyingTo });
    patchRoom(roomId, {
      lastMessage: text,
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    });
    setReplyingTo(null);
    setTypingStatus(false);
    setShowNewMessages(false);
    requestAnimationFrame(() => scrollToBottom("smooth"));
  }, [roomId, replyingTo, sendMessage, patchRoom, scrollToBottom, setTypingStatus]);

  const handleReplyToMessage = useCallback(
    (message: Message) => {
      if (message.type === "system") return;
      setReplyingTo(getReplyDraft(message, currentUserId));
      setSelectedMessage(null);
      requestAnimationFrame(() => scrollToBottom("smooth"));
    },
    [currentUserId, scrollToBottom]
  );

  const handleCopyMessage = useCallback(async (message: Message) => {
    if (message.type !== "text") return;

    try {
      await navigator.clipboard.writeText(message.content);
      setCopyToast("Copied");
      setSelectedMessage(null);
      setTimeout(() => setCopyToast(""), 1400);
    } catch (err) {
      console.error("Failed to copy message:", err);
      setCopyToast("Copy failed");
      setTimeout(() => setCopyToast(""), 1400);
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent, message: Message) => {
    if (message.type === "system") return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      suppressNextClickRef.current = true;
      setSelectedMessage(message);
      setSwipeState(null);
      longPressTimerRef.current = null;
    }, 500);

    setSwipeState({
      messageId: message.id,
      startX: event.clientX,
      startY: event.clientY,
      offset: 0,
    });
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      setSwipeState((current) => {
        if (!current) return null;

        const deltaX = event.clientX - current.startX;
        const deltaY = event.clientY - current.startY;

        const dragThreshold = 6;
        if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }

        if (Math.abs(deltaY) > 16 && Math.abs(deltaY) > Math.abs(deltaX)) {
          return null;
        }

        if (deltaX <= 0) {
          return {
            ...current,
            offset: 0,
          };
        }

        return {
          ...current,
          offset: Math.min(deltaX, 74),
        };
      });
    },
    []
  );

  const handlePointerEnd = useCallback(
    (message: Message) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      setSwipeState((current) => {
        if (current?.messageId === message.id && current.offset >= 54) {
          suppressNextClickRef.current = true;
          setReplyingTo(getReplyDraft(message, currentUserId));
          requestAnimationFrame(() => scrollToBottom("smooth"));
        }
        return null;
      });
    },
    [currentUserId, scrollToBottom]
  );

  const handleMessageSelect = useCallback((message: Message) => {
    if (message.type === "system") return;

    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    setSelectedMessage(message);
  }, []);

  // Block User DM trigger
  const handleBlockUser = async () => {
    try {
      const supabase = createClient();
      
      // If direct chat, resolve peer ID
      const { data: peer } = await supabase
        .from("room_participants")
        .select("profile_id")
        .eq("room_id", roomId)
        .neq("profile_id", currentUserId)
        .maybeSingle();

      if (peer && peer.profile_id) {
        await supabase.from("user_blocks").insert({
          blocker_id: currentUserId,
          blocked_id: peer.profile_id,
        });
        showToast("Peer user has been blocked. Conversation will be locked.", "info");
        router.push("/chats");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartPrivateChat = async () => {
    if (!selectedPeerProfile) return;
    setIsCreatingChat(true);
    try {
      const res = await resolveDirectMessageRoom(selectedPeerProfile.id);
      if (res.success && res.data) {
        setSelectedPeerProfile(null);
        router.push(`/chats/${res.data}`);
      } else {
        showToast(res.message || "Chat unavailable", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Chat unavailable", "error");
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    patchRoom(roomId, { isMuted: nextMuted });
    setShowOptions(false);

    const supabase = createClient();
    const { error } = await supabase
      .from("room_participants")
      .update({ is_muted: nextMuted })
      .eq("room_id", roomId)
      .eq("profile_id", currentUserId);

    if (error) {
      setIsMuted(!nextMuted);
      patchRoom(roomId, { isMuted: !nextMuted });
      console.error("Failed to update mute state:", error);
      showToast("Could not update mute state. Please try again.", "error");
    }
  };

  // File Upload trigger
  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      e.target.value = "";
    }
  };

  const handleSendEditedImage = async (editedBlob: Blob) => {
    if (!selectedFile) return;
    const originalFileName = selectedFile.name;
    setSelectedFile(null); // Close modal instantly!
    setIsUploading(true);

    let optimizedBlob: Blob | null = null;
    let fileUrlResult = "";

    try {
      // 1. Wrap raw Blob into File object
      const fileToOptimize = new File([editedBlob], originalFileName, {
        type: "image/png",
      });

      // 2. Client-side EXIF stripping & compression to WebP
      optimizedBlob = await optimizeAndStripImage(fileToOptimize);
      if (optimizedBlob.size > MAX_IMAGE_UPLOAD_BYTES) {
        throw new Error("Image is too large after optimization.");
      }

      // 3. Request presigned upload URL from R2
      const res = await getPresignedUploadUrl(
        roomId,
        originalFileName.replace(/\.[^/.]+$/, "") + ".webp",
        "image/webp",
        optimizedBlob.size
      );

      if (!res.success || !res.data) {
        throw new Error(res.message || "Failed to initiate secure upload channel.");
      }

      const { uploadUrl, fileUrl } = res.data;
      fileUrlResult = fileUrl;

      // 4. PUT request payload via presigned URL tunnel
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: optimizedBlob,
        headers: {
          "Content-Type": "image/webp",
        },
      });

      if (!uploadRes.ok) {
        throw new Error("R2 upload rejected binary payload.");
      }

      // 5. Send image type message in chat room
      sendMessage("", { type: "image", mediaUrl: fileUrlResult, replyTo: replyingTo });
      setReplyingTo(null);
      setShowNewMessages(false);
      requestAnimationFrame(() => scrollToBottom("smooth"));
      setIsUploading(false);
    } catch (err) {
      console.error("Secure image upload failed:", err);
      showToast("Failed to securely share image. Please try again.", "error");
      setIsUploading(false);
    }
  };

  const handleCameraUpload = () => {
    cameraInputRef.current?.click();
  };

  // Defer forwarding state to ForwardMessageModal

  // Submit report action
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim() || !reportingMessageId) return;

    try {
      const res = await submitSafetyReport(reportingMessageId, reportReason.trim(), roomId);
      if (res.success) {
        showToast("Report submitted anonymously. Administrators will review the transcript.", "success");
      } else {
        showToast(res.message || "Failed to submit report. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportingMessageId(null);
      setReportReason("");
    }
  };

  return (
    <main
      ref={mainRef}
      className="flex-1 flex flex-col bg-[#08080C] h-full relative overflow-hidden"
    >
      {/* Background Decorative Blur */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-[#00F0A0]/5 rounded-full blur-[90px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-[#00D2FF]/3 rounded-full blur-[80px]" />
      </div>

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-[#08080C]/85 backdrop-blur-md border-b border-zinc-900/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Back Chevron */}
          <button
            onClick={() => router.push("/chats")}
            className="text-zinc-400 hover:text-white transition-colors p-2 rounded-full active:scale-95 duration-150 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Room Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800/80 flex items-center justify-center text-xl shadow-sm relative select-none">
              {roomData.avatar_emoji}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-[15px] font-bold text-white tracking-tight truncate">
                {roomData.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-[#00F0A0] rounded-full shadow-[0_0_6px_rgba(0,240,160,0.5)] animate-pulse" />
                <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase font-sans">
                  {roomData.type === "group" ? "Group Chat" : "Private Chat"}
                </span>
                {roomData.pinned_message_id && (
                  <>
                    <span className="text-zinc-650 text-[10px] select-none">•</span>
                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider font-sans flex items-center gap-0.5" data-testid="header-pinned-indicator">
                      📌 Pinned
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Menu (Mute/Block/Report) */}
        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-zinc-400 hover:text-white transition-colors p-2 rounded-full active:scale-95 duration-150 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          {/* Options Dropdown Box */}
          {showOptions && (
            <div className="absolute right-0 mt-2 w-44 bg-[#12121A] border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-900/60 animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                onClick={handleToggleMute}
                className="w-full text-left px-4 py-3 text-xs text-zinc-300 hover:bg-zinc-800/40 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M23 9l-6 6M17 9l6 6" />
                </svg>
                {isMuted ? "Unmute Notifications" : "Mute Notifications"}
              </button>
              {roomData.type === "direct" && (
                <button
                  onClick={() => {
                    handleBlockUser();
                    setShowOptions(false);
                  }}
                  className="w-full text-left px-4 py-3 text-xs text-[#FF4B72] hover:bg-[#FF4B72]/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  Block Student
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Pinned Message Sticky Banner */}
      {pinnedMessage && (
        <div
          data-testid="pinned-banner"
          onClick={() => handleScrollToMessage(pinnedMessage.id)}
          className="bg-[#12121A]/80 backdrop-blur-md border-b border-zinc-900/60 px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#161622]/95 active:bg-[#12121A] transition-all animate-in slide-in-from-top duration-200 z-30"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm flex-shrink-0" role="img" aria-label="Pinned">📌</span>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                Pinned Message
              </span>
              <p className="text-xs text-zinc-200 truncate mt-0.5">
                {pinnedMessage.type === "image" ? "Photo" : pinnedMessage.content}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="unpin-button"
            onClick={async (e) => {
              e.stopPropagation();
              const prevPinnedId = roomData.pinned_message_id;
              
              // Optimistic update
              setRoomData((prev) => ({ ...prev, pinned_message_id: null }));
              const local = await localDB.rooms.get(roomId);
              if (local) {
                await localDB.rooms.update(roomId, { pinned_message_id: null });
              }

              const res = await pinMessage(null);
              if (!res.success) {
                // Rollback
                setRoomData((prev) => ({ ...prev, pinned_message_id: prevPinnedId }));
                if (local) {
                  await localDB.rooms.update(roomId, { pinned_message_id: prevPinnedId });
                }
              }
            }}
            className="px-2.5 py-1 text-[9px] font-black text-[#FF4B72] border border-[#FF4B72]/20 hover:bg-[#FF4B72]/10 hover:border-[#FF4B72]/30 active:scale-95 transition-all rounded-full cursor-pointer uppercase tracking-wider flex-shrink-0"
          >
            Unpin
          </button>
        </div>
      )}

      {/* Message Feed Display */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 flex flex-col chat-container relative z-10"
      >
        <div ref={olderMessagesRef} className="min-h-1" />

        {hasMore && messages.length >= 30 && (
          <div className="flex justify-center py-1">
            {loadingOlder ? (
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-wider font-sans">
                Loading older messages...
              </span>
            ) : olderLoadError ? (
              <button
                onClick={async () => {
                  const container = chatContainerRef.current;
                  if (!container) return;

                  const previousHeight = container.scrollHeight;
                  const previousScrollTop = container.scrollTop;
                  lastScrollHeightRef.current = previousHeight;
                  lastScrollTopRef.current = previousScrollTop;

                  await loadMore();
                }}
                className="text-[10px] font-black text-[#00F0A0] uppercase tracking-wider font-sans cursor-pointer"
              >
                Retry older messages
              </button>
            ) : (
              <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider font-sans">
                Earlier messages
              </span>
            )}
          </div>
        )}



        {/* Messages Loop */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-zinc-500 text-xs font-sans">Connecting to channel history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 select-none">
              🎓
            </div>
            <p className="text-zinc-500 text-xs font-sans">Say something to start the conversation anonymously.</p>
          </div>
        ) : (
          displayMessages.map((msg, index) => {
            const isMine = msg.sender_id === currentUserId;
            const swipeOffset =
              swipeState?.messageId === msg.id ? swipeState.offset : 0;

            const isFirstUnread = initialUnreadCountRef.current > 0 &&
              index === displayMessages.length - initialUnreadCountRef.current;

            return (
              <Fragment key={msg.id}>
                {isFirstUnread && (
                  <div
                    data-unread-separator="true"
                    className="flex items-center gap-2.5 my-5 select-none animate-in fade-in duration-300 w-full"
                  >
                    <div className="flex-1 h-px bg-[#FF4B72]/20" />
                    <span className="px-3.5 py-1 bg-[#FF4B72]/10 border border-[#FF4B72]/20 text-[9px] font-black text-[#FF4B72] rounded-full tracking-wider uppercase font-sans shadow-sm">
                      New Messages
                    </span>
                    <div className="flex-1 h-px bg-[#FF4B72]/20" />
                  </div>
                )}
                <MessageBubble
                  id={msg.id}
                  content={msg.content}
                  type={msg.type}
                  mediaUrl={msg.media_url}
                  createdAt={msg.created_at}
                  formattedTime={msg.formatted_time}
                  isMine={isMine}
                  senderNickname={msg.sender_nickname}
                  senderAvatar={msg.sender_avatar}
                  reactions={msg.reactions}
                  deliveryStatus={msg.delivery_status}
                  clientMessageId={msg.client_message_id}
                  swipeOffset={swipeOffset}
                  replyToContent={msg.reply_to_content}
                  replyToSender={msg.reply_to_sender_nickname}
                  isForwarded={msg.is_forwarded || false}
                  currentUserId={currentUserId}
                  senderId={msg.sender_id}
                  onPeerClick={handlePeerClick}
                  onSelect={handleMessageSelect}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  onContextMenu={handleContextMenu}
                  onToggleReaction={toggleReaction}
                  onRetryMessage={retryMessage}
                  onImageLoad={handleImageLoad}
                  onImageClick={handleImageClick}
                  mediaMetadata={msg.media_metadata}
                  isPinned={roomData.pinned_message_id === msg.id}
                />
              </Fragment>
            );
          })
        )}

        {/* Dynamic Typing indicator bubbles inside feed */}
        {typingUsers.map((user) => (
          <div key={user.id} className="flex gap-3 animate-pulse mt-2 select-none justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800/80 flex items-center justify-center text-sm shadow-sm select-none">
              {user.avatar_emoji}
            </div>
            <div className="flex flex-col gap-1 max-w-[80%]">
              <span className="text-[10px] font-bold text-zinc-400 ml-1 font-sans">
                {user.nickname}
              </span>
              <div className="bg-[#12121A] border border-zinc-900 p-2.5 rounded-2xl rounded-tl-none text-xs text-zinc-400 font-sans italic flex items-center gap-1 select-none w-max">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-75" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-150" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-300" />
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />

        {showNewMessages && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom("smooth");
              setShowNewMessages(false);
              markRoomRead();
              patchRoom(roomId, { unreadCount: 0 });
            }}
            className="sticky bottom-2 self-center z-20 px-3.5 py-2 rounded-full bg-[#00F0A0] text-black text-[10px] font-black uppercase tracking-wider shadow-[0_8px_24px_rgba(0,240,160,0.25)] active:scale-95 transition-transform cursor-pointer"
          >
            New messages
          </button>
        )}
      </div>

      {/* Input Form Bar */}
      {/* Input Composer Bar */}
      <MessageComposer
        onSend={handleSendMessage}
        onAttachImage={handleFileUpload}
        onAttachCamera={handleCameraUpload}
        setTypingStatus={setTypingStatus}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {copyToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[70] px-3.5 py-2 rounded-full bg-white text-black text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          {copyToast}
        </div>
      )}

      {/* Selected Message Action Sheet */}
      {selectedMessage && (
        <div
          className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] flex items-end justify-center"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="w-full max-w-[480px] bg-[#12121A] border-t border-zinc-800 rounded-t-3xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-4" />

            <div className="mb-4 px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                {selectedIsMine ? "Your message" : selectedMessage.sender_nickname || "Anonymous Student"}
              </span>
              <p className="text-sm text-zinc-200 truncate mt-1">
                {selectedMessage.type === "image" ? "Photo" : selectedMessage.content}
              </p>
            </div>

            <div className="flex items-center gap-2 p-1.5 bg-[#08080C] border border-zinc-900 rounded-full mb-3">
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(selectedMessage.id, emoji);
                    setSelectedMessage(null);
                  }}
                  className="flex-1 h-9 rounded-full flex items-center justify-center text-lg hover:bg-zinc-900 active:scale-90 transition-all cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleReplyToMessage(selectedMessage)}
                className="h-16 rounded-2xl bg-[#08080C] border border-zinc-900 text-zinc-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 17 4 12 9 7" />
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                </svg>
                <span className="text-[10px] font-bold">Reply</span>
              </button>

              <button
                type="button"
                disabled={selectedMessage.type !== "text"}
                onClick={() => handleCopyMessage(selectedMessage)}
                className="h-16 rounded-2xl bg-[#08080C] border border-zinc-900 text-zinc-200 disabled:text-zinc-700 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span className="text-[10px] font-bold">Copy</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setForwardingMessage(selectedMessage);
                  setSelectedMessage(null);
                }}
                className="h-16 rounded-2xl bg-[#08080C] border border-zinc-900 text-zinc-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 17 20 12 15 7" />
                  <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
                </svg>
                <span className="text-[10px] font-bold">Forward</span>
              </button>

              {/* Pin / Unpin Button */}
              {selectedMessage.type !== "system" && (
                <button
                  type="button"
                  data-testid="action-pin"
                  onClick={async () => {
                    const isPinned = roomData.pinned_message_id === selectedMessage.id;
                    const nextPinnedId = isPinned ? null : selectedMessage.id;
                    
                    // Optimistic update
                    setRoomData((prev) => ({ ...prev, pinned_message_id: nextPinnedId }));
                    const local = await localDB.rooms.get(roomId);
                    if (local) {
                      await localDB.rooms.update(roomId, { pinned_message_id: nextPinnedId });
                    }

                    const res = await pinMessage(nextPinnedId);
                    if (!res.success) {
                      // Rollback on error
                      setRoomData((prev) => ({ ...prev, pinned_message_id: local?.pinned_message_id || null }));
                      if (local) {
                        await localDB.rooms.update(roomId, { pinned_message_id: local.pinned_message_id || null });
                      }
                    }
                    setSelectedMessage(null);
                  }}
                  className={`h-16 rounded-2xl border flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer ${
                    roomData.pinned_message_id === selectedMessage.id
                      ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                      : "bg-[#08080C] border-zinc-900 text-zinc-200"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="17" x2="12" y2="22" />
                    <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24V17z" />
                  </svg>
                  <span className="text-[10px] font-bold">
                    {roomData.pinned_message_id === selectedMessage.id ? "Unpin" : "Pin"}
                  </span>
                </button>
              )}

              {/* Delete / Report Button */}
              {selectedIsMine ? (
                <button
                  type="button"
                  data-testid="action-delete"
                  onClick={async () => {
                    await deleteMessage(selectedMessage.id);
                    setSelectedMessage(null);
                  }}
                  className="h-16 rounded-2xl bg-[#FF4B72]/10 border border-[#FF4B72]/20 text-[#FF4B72] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span className="text-[10px] font-bold">Delete</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReportingMessageId(selectedMessage.id);
                    setSelectedMessage(null);
                  }}
                  className="h-16 rounded-2xl bg-[#08080C] border border-zinc-900 text-[#FF4B72] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
                  </svg>
                  <span className="text-[10px] font-bold">Report</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Peer Profile Bottom Sheet */}
      {selectedPeerProfile && (
        <div
          className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] flex items-end justify-center"
          onClick={() => setSelectedPeerProfile(null)}
        >
          <div
            className="w-full max-w-[480px] bg-[#12121A] border-t border-zinc-800 rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 fade-in duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-6" />

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700/80 flex items-center justify-center text-4xl shadow-md mb-3 select-none">
                {selectedPeerProfile.avatar_emoji}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {selectedPeerProfile.nickname}
              </h3>
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase font-sans mt-1">
                AMU Student
              </span>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleStartPrivateChat}
                disabled={isCreatingChat}
                className="w-full h-12 rounded-xl bg-[#00F0A0] text-black font-semibold flex items-center justify-center gap-2.5 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCreatingChat ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Message Student</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedPeerProfile(null)}
                className="w-full h-12 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-400 font-semibold flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Reporting Overlay Dialog */}
      {reportingMessageId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#12121A] border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold font-heading text-white mb-2">
              Anonymous Safety Report
            </h3>
            <p className="text-xs text-zinc-400 font-sans mb-4 leading-relaxed">
              Help keep Aligarh Muslim University chat safe. Your report is completely confidential and hides your peer identity.
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <textarea
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
                className="w-full bg-[#08080C] border border-zinc-800 focus:border-[#00F0A0] focus:ring-1 focus:ring-[#00F0A0] text-white font-sans text-xs rounded-xl p-3.5 focus:outline-none transition-all placeholder:text-zinc-650"
                placeholder="Describe the violation (harassment, domain leakage attempt, offensive content, spam)..."
              />

              <div className="flex gap-3 justify-end text-xs font-semibold select-none">
                <button
                  type="button"
                  onClick={() => {
                    setReportingMessageId(null);
                    setReportReason("");
                  }}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#00F0A0] text-black shadow-lg shadow-[#00F0A0]/10 cursor-pointer active:scale-95 transition-transform"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input for media uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Hidden file input specifically for camera capture */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Forward Message Bottom Sheet / Modal */}
      {forwardingMessage && (
        <ForwardMessageModal
          forwardingMessage={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
          currentUserId={currentUserId}
          showToast={showToast}
        />
      )}

      {/* Image Editor Overlay Modal */}
      {selectedFile && (
        <ImageEditorModal
          file={selectedFile}
          onSave={handleSendEditedImage}
          onCancel={() => setSelectedFile(null)}
        />
      )}

      {/* Uploading Spinner Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-zinc-800 border-t-[#00F0A0] rounded-full animate-spin" />
          <span className="text-xs text-zinc-400 font-sans tracking-wide">
            Encrypting & Uploading Media...
          </span>
        </div>
      )}

      {/* Premium Glassmorphic Toast Notification */}
      {toast && (
        <div 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ease-out transform"
          style={{
            animation: "toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          }}
        >
          <style>{`
            @keyframes toastSlideIn {
              from {
                opacity: 0;
                transform: translate(-50%, -20px);
              }
              to {
                opacity: 1;
                transform: translate(-50%, 0);
              }
            }
          `}</style>
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0F0F15]/95 border border-zinc-800/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] max-w-sm pointer-events-auto">
            {toast.type === "success" && (
              <span className="w-5.5 h-5.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 select-none">
                ✓
              </span>
            )}
            {toast.type === "error" && (
              <span className="w-5.5 h-5.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-bold shrink-0 select-none">
                ✕
              </span>
            )}
            {toast.type === "info" && (
              <span className="w-5.5 h-5.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0 select-none">
                ℹ
              </span>
            )}
            <p className="text-xs font-semibold text-zinc-300 font-sans tracking-wide leading-relaxed select-none">
              {toast.message}
            </p>
          </div>
        </div>
      )}

      {/* Expanded image viewer lightbox modal */}
      <ImageViewerModal
        isOpen={!!viewingImageUrl}
        imageUrl={viewingImageUrl}
        onClose={() => setViewingImageUrl(null)}
      />
    </main>
  );
}

interface ForwardMessageModalProps {
  forwardingMessage: Message;
  onClose: () => void;
  currentUserId: string;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

function ForwardMessageModal({
  forwardingMessage,
  onClose,
  currentUserId,
  showToast,
}: ForwardMessageModalProps) {
  // Scoped subscription: only active when modal is mounted!
  const rooms = useInboxStore(useCallback((state: InboxState) => state.rooms, []));
  const [forwardedRoomIds, setForwardedRoomIds] = useState<Set<string>>(new Set());
  const [forwardingRoomId, setForwardingRoomId] = useState<string | null>(null);

  const handleForwardSelect = async (targetRoomId: string) => {
    setForwardingRoomId(targetRoomId);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("messages")
        .insert({
          room_id: targetRoomId,
          sender_id: currentUserId,
          content: forwardingMessage.content,
          type: forwardingMessage.type,
          media_url: forwardingMessage.media_url || null,
          is_forwarded: true,
        });

      if (error) throw error;
      
      setForwardedRoomIds((prev) => {
        const next = new Set(prev);
        next.add(targetRoomId);
        return next;
      });
      
      showToast("Message forwarded", "success");
    } catch (err: any) {
      console.error("Failed to forward message:", err?.message || err?.details || err);
      showToast("Failed to forward message", "error");
    } finally {
      setForwardingRoomId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#12121A] border-t border-zinc-800 rounded-t-3xl shadow-2xl p-6 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4 fade-in duration-150"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-5 shrink-0" />

        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-base font-bold text-white tracking-tight">
            Forward Message
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-white cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Preview of forwarded content */}
        <div className="p-3 bg-[#08080C] border border-zinc-900 rounded-xl mb-4 shrink-0 flex items-center gap-3">
          {forwardingMessage.type === "image" && forwardingMessage.media_url ? (
            <>
              <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                <img src={forwardingMessage.media_url} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-zinc-400 font-sans italic truncate">Photo</span>
            </>
          ) : (
            <p className="text-xs text-zinc-400 font-sans line-clamp-2 leading-relaxed">
              {forwardingMessage.content}
            </p>
          )}
        </div>

        {/* List of rooms */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
          {rooms.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6 font-sans">No active chats found.</p>
          ) : (
            rooms.map((room) => {
              const isSent = forwardedRoomIds.has(room.id);
              const isSending = forwardingRoomId === room.id;

              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/20 border border-zinc-950 hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800 flex items-center justify-center text-lg select-none">
                      {room.avatar_emoji}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">{room.name}</span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-sans font-black mt-0.5">
                        {room.type === "group" ? "Group Chat" : "Private Chat"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSent || isSending}
                    onClick={() => handleForwardSelect(room.id)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      isSent
                        ? "bg-zinc-800 text-zinc-500 border border-zinc-800 cursor-default"
                        : isSending
                        ? "bg-[#00F0A0]/10 border border-[#00F0A0]/20 text-[#00F0A0] cursor-default"
                        : "bg-[#00F0A0] text-black hover:scale-105 active:scale-95 shadow-sm"
                    }`}
                  >
                    {isSending ? (
                      <div className="w-3 h-3 border-2 border-[#00F0A0] border-t-transparent rounded-full animate-spin mx-2" />
                    ) : isSent ? (
                      "Sent"
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
