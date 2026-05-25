"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Message, ReplyDraft, useChat } from "@/hooks/use-chat";
import { createClient } from "@/lib/supabase/client";
import { submitSafetyReport } from "@/app/actions/report";
import { useInboxStore } from "@/hooks/use-inbox-store";
import ImageEditorModal from "@/components/common/ImageEditorModal";
import { optimizeAndStripImage } from "@/lib/utils/media";
import { getPresignedUploadUrl } from "@/app/actions/media";

interface ChatRoomClientProps {
  roomId: string;
  initialRoomData: {
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
  longPressTimer?: ReturnType<typeof setTimeout>;
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
  const { patchRoom } = useInboxStore();
  const roomData = initialRoomData;
  const [inputText, setInputText] = useState("");
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const olderMessagesRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const previousNewestMessageIdRef = useRef<string | null>(null);
  const suppressNextClickRef = useRef(false);

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
  } = useChat(roomId, currentUserId);

  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const newestMessage = messages[0];
  const selectedIsMine = selectedMessage?.sender_id === currentUserId;

  const isNearBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return true;

    return container.scrollHeight - container.scrollTop - container.clientHeight < 140;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Load mute state from the user's participant row.
  useEffect(() => {
    if (roomId.startsWith("mock-")) return;

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

  // Scroll and read-state rules for a stable chat viewport.
  useEffect(() => {
    if (loading || messages.length === 0) return;

    const newestMessage = messages[0];

    if (!initialScrollDoneRef.current) {
      scrollToBottom("auto");
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
        const loadedCount = await loadMore();

        if (loadedCount > 0) {
          requestAnimationFrame(() => {
            container.scrollTop += container.scrollHeight - previousHeight;
          });
        }
      },
      { root: container, rootMargin: "160px 0px 0px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingOlder, messages.length]);

  // Typing state timer
  useEffect(() => {
    if (!inputText) {
      setTypingStatus(false);
      return;
    }

    setTypingStatus(true);
    const delayDebounceFn = setTimeout(() => {
      setTypingStatus(false);
    }, 3000);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText, setTypingStatus]);

  // Handle message send
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendMessage(inputText.trim(), { replyTo: replyingTo });
    patchRoom(roomId, {
      lastMessage: inputText.trim(),
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    });
    setInputText("");
    setReplyingTo(null);
    setTypingStatus(false);
    setShowNewMessages(false);
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

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

    const longPressTimer = setTimeout(() => {
      suppressNextClickRef.current = true;
      setSelectedMessage(message);
      setSwipeState(null);
    }, 420);

    setSwipeState({
      messageId: message.id,
      startX: event.clientX,
      startY: event.clientY,
      offset: 0,
      longPressTimer,
    });
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      setSwipeState((current) => {
        if (!current) return null;

        const deltaX = event.clientX - current.startX;
        const deltaY = event.clientY - current.startY;

        if (Math.abs(deltaY) > 24 && Math.abs(deltaY) > Math.abs(deltaX)) {
          if (current.longPressTimer) clearTimeout(current.longPressTimer);
          return null;
        }

        if (deltaX <= 0) return current;
        if (current.longPressTimer && deltaX > 8) clearTimeout(current.longPressTimer);

        return {
          ...current,
          longPressTimer: undefined,
          offset: Math.min(deltaX, 74),
        };
      });
    },
    []
  );

  const handlePointerEnd = useCallback(
    (message: Message) => {
      setSwipeState((current) => {
        if (current?.longPressTimer) clearTimeout(current.longPressTimer);
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
        alert("Peer user has been blocked. Conversation will be locked.");
        router.push("/chats");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    patchRoom(roomId, { isMuted: nextMuted });
    setShowOptions(false);

    if (roomId.startsWith("mock-")) return;

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
      alert("Could not update mute state. Please try again.");
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

      // 3. Request presigned upload URL from R2
      const res = await getPresignedUploadUrl(
        roomId,
        originalFileName.replace(/\.[^/.]+$/, "") + ".webp",
        "image/webp"
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
      console.warn("R2 upload failed, falling back to local base64 mock storage:", err);
      
      // If we have the optimized blob, convert to Base64 so the app works locally without external R2 config
      if (optimizedBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendMessage("", { type: "image", mediaUrl: base64data, replyTo: replyingTo });
          setReplyingTo(null);
          setShowNewMessages(false);
          requestAnimationFrame(() => scrollToBottom("smooth"));
          setIsUploading(false);
        };
        reader.onerror = () => {
          alert("Failed to process image fallback.");
          setIsUploading(false);
        };
        reader.readAsDataURL(optimizedBlob);
      } else {
        alert("Failed to securely share image. Please try again.");
        setIsUploading(false);
      }
    }
  };

  // Submit report action
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim() || !reportingMessageId) return;

    try {
      const res = await submitSafetyReport(reportingMessageId, reportReason.trim(), roomId);
      if (res.success) {
        alert("Report submitted anonymously. Administrators will review the transcript.");
      } else {
        alert(res.message || "Failed to submit report. Please try again.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportingMessageId(null);
      setReportReason("");
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-[#08080C] min-h-screen relative overflow-hidden">
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
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-[#00F0A0] rounded-full shadow-[0_0_6px_rgba(0,240,160,0.5)] animate-pulse" />
                <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase font-sans">
                  {roomData.type === "group" ? "Group Chat" : "Private Chat"}
                </span>
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
                  const loadedCount = await loadMore();
                  if (loadedCount > 0) {
                    requestAnimationFrame(() => {
                      container.scrollTop += container.scrollHeight - previousHeight;
                    });
                  }
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

        {/* Dynamic Typing indicator bubble inside feed */}
        {typingUsers.size > 0 && (
          <div className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shadow-sm select-none">
              💬
            </div>
            <div className="flex flex-col gap-1 max-w-[80%]">
              <span className="text-[10px] font-bold text-zinc-500 font-sans tracking-wide ml-1">
                Someone is typing
              </span>
              <div className="bg-[#12121A] border border-zinc-900 p-2.5 rounded-2xl rounded-tl-none text-xs text-zinc-400 font-sans italic flex items-center gap-1 select-none">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-75" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-150" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-300" />
              </div>
            </div>
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
          displayMessages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            const swipeOffset =
              swipeState?.messageId === msg.id ? swipeState.offset : 0;
            
            if (msg.type === "system") {
              return (
                <div key={msg.id} className="flex justify-center my-2 select-none animate-in fade-in duration-300">
                  <span className="px-3.5 py-1 bg-zinc-900/60 text-[9px] font-black text-zinc-500 border border-zinc-900 rounded-full tracking-wider uppercase font-sans shadow-sm">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 group animate-in fade-in slide-in-from-bottom-2 duration-300 relative ${
                  isMine ? "justify-end" : "justify-start"
                }`}
              >
                {swipeOffset > 8 && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#00F0A0]/15 border border-[#00F0A0]/20 text-[#00F0A0] flex items-center justify-center ${
                      isMine ? "right-2" : "left-12"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 17 4 12 9 7" />
                      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                    </svg>
                  </div>
                )}

                {/* Peer user avatar */}
                {!isMine && (
                  <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800/80 flex items-center justify-center text-base shadow-sm self-end mb-1 select-none">
                    {msg.sender_avatar}
                  </div>
                )}

                <div className={`flex flex-col gap-1 max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                  {/* Sender nickname on DMs/Groups */}
                  {!isMine && (
                    <span className="text-[10px] font-bold text-zinc-400 ml-1 font-sans">
                      {msg.sender_nickname}
                    </span>
                  )}

                  {/* Message bubble */}
                  <div
                    onClick={() => handleMessageSelect(msg)}
                    onPointerDown={(event) => handlePointerDown(event, msg)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => handlePointerEnd(msg)}
                    onPointerCancel={() => handlePointerEnd(msg)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedMessage(msg);
                    }}
                    style={{
                      transform: `translateX(${swipeOffset}px)`,
                    }}
                    className={`p-3.5 rounded-2xl relative shadow-md cursor-pointer transition-transform touch-pan-y select-none active:scale-[0.98] ${
                      isMine
                        ? "bg-[#00F0A0] text-black font-semibold rounded-tr-none"
                        : "bg-[#12121A] text-zinc-100 border border-zinc-900 rounded-tl-none"
                    }`}
                  >
                    {msg.reply_to_content && (
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        className={`w-full text-left mb-2 rounded-xl border-l-2 px-2.5 py-2 ${
                          isMine
                            ? "bg-black/10 border-black/40 text-black/70"
                            : "bg-black/20 border-[#00F0A0]/60 text-zinc-300"
                        }`}
                      >
                        <span className="block text-[10px] font-black uppercase tracking-wider truncate">
                          {msg.reply_to_sender_nickname || "Anonymous Student"}
                        </span>
                        <span className="block text-[11px] leading-snug truncate opacity-80">
                          {msg.reply_to_content}
                        </span>
                      </button>
                    )}

                    {msg.type === "image" && msg.media_url ? (
                      <div className="relative rounded-lg overflow-hidden max-w-full my-1 border border-zinc-850">
                        <img
                          src={msg.media_url}
                          alt="Shared Media"
                          className="max-h-[300px] object-contain w-full rounded-lg"
                          loading="lazy"
                        />
                        {msg.content && msg.content !== "Photo" && (
                          <p className="text-[14px] leading-relaxed break-words font-sans mt-2">
                            {msg.content}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[14px] leading-relaxed break-words font-sans">
                        {msg.content}
                      </p>
                    )}
                  </div>

                  {/* Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                        if (!userIds || userIds.length === 0) return null;
                        const userReacted = userIds.includes(currentUserId);
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 border text-[10px] font-bold shadow-sm transition-all duration-150 cursor-pointer ${
                              userReacted
                                ? "bg-[#00F0A0]/10 border-[#00F0A0]/30 text-[#00F0A0]"
                                : "bg-[#12121A]/80 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Timestamp & read confirmation */}
                  <div className="flex items-center gap-1 mt-0.5 px-1 select-none">
                    <span className="text-[9px] text-zinc-600 font-sans tracking-wide">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMine && (
                      <>
                        {msg.delivery_status === "sending" && (
                          <span className="text-[9px] text-zinc-600 font-sans">sending</span>
                        )}
                        {msg.delivery_status === "failed" && msg.client_message_id && (
                          <button
                            type="button"
                            onClick={() => retryMessage(msg.client_message_id!)}
                            className="text-[9px] text-[#FF4B72] font-bold font-sans cursor-pointer"
                          >
                            retry
                          </button>
                        )}
                        {msg.delivery_status !== "sending" && msg.delivery_status !== "failed" && (
                          <span className="text-[#00F0A0]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

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
      <footer className="sticky bottom-0 left-0 right-0 p-4 bg-[#08080C]/90 backdrop-blur-xl border-t border-zinc-900/60 z-30">
        {replyingTo && (
          <div className="mb-3 rounded-2xl bg-[#12121A] border border-zinc-800 shadow-lg overflow-hidden">
            <div className="flex items-stretch">
              <div className="w-1 bg-[#00F0A0]" />
              <div className="flex-1 min-w-0 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#00F0A0] truncate">
                    Replying to {replyingTo.senderNickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="text-zinc-500 hover:text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
                    aria-label="Cancel reply"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-zinc-400 truncate mt-1">
                  {replyingTo.content}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-3 w-full">
          {/* Media Attach button */}
          <button
            type="button"
            onClick={handleFileUpload}
            className="w-12 h-12 rounded-full bg-[#12121A] border border-zinc-850 hover:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 duration-200 cursor-pointer shadow-sm"
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Text Input area */}
          <div className="flex-1 bg-[#12121A]/70 border border-zinc-900 rounded-full flex items-center px-4 py-2 h-12 shadow-inner focus-within:border-zinc-850 transition-colors">
            <input
              type="text"
              required
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="bg-transparent border-none text-white text-[14px] placeholder-zinc-600 w-full focus:ring-0 focus:outline-none font-sans"
              placeholder={`Message in anonymous room...`}
            />
          </div>

          {/* Send FAB Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-12 h-12 rounded-full bg-[#00F0A0] text-black flex items-center justify-center shadow-[0_4px_16px_rgba(0,240,160,0.3)] disabled:opacity-40 disabled:shadow-none hover:scale-105 active:scale-90 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
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
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        {/* Mobile gestures safe padding */}
        <div className="h-2" />
      </footer>

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
    </main>
  );
}
