"use client";

import React, { memo, useEffect } from "react";
import { type Message } from "@/hooks/use-chat";

interface MessageBubbleProps {
  id: string;
  content: string;
  type: "text" | "image" | "system";
  mediaUrl: string | undefined;
  createdAt: string;
  formattedTime: string | undefined;
  isMine: boolean;
  senderNickname: string | undefined;
  senderAvatar: string | undefined;
  reactions: Message["reactions"];
  deliveryStatus: Message["delivery_status"];
  clientMessageId: string | undefined;
  swipeOffset: number;
  replyToContent: string | undefined;
  replyToSender: string | undefined;
  isForwarded: boolean;
  currentUserId: string;
  senderId: string;
  
  // Callbacks
  onPeerClick: (id: string, nickname: string, avatar: string) => void;
  onSelect: (msg: any) => void;
  onPointerDown: (event: React.PointerEvent, msg: any) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (msg: any) => void;
  onPointerCancel: (msg: any) => void;
  onContextMenu: (event: React.MouseEvent, msg: any) => void;
  onToggleReaction: (msgId: string, emoji: string) => void;
  onRetryMessage: (clientMessageId: string) => void;
  onImageLoad?: () => void;
  onImageClick?: (url: string) => void;
  
  // Media aspect ratios
  mediaMetadata?: {
    width?: number;
    height?: number;
    aspect_ratio?: number;
  };
  isPinned?: boolean;
}

const isEmojiOnly = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /^[\p{Extended_Pictographic}\s\u200d\ufe0f]+$/u.test(trimmed);
};

// Matches both https?:// URLs and bare www. URLs (e.g. www.veilo.shop)
const URL_REGEX = /(https?:\/\/[^\s<>"'\]\)]+|www\.[^\s<>"'\]\)]+)/gi;

const parseTextWithLinks = (text: string, isMine: boolean) => {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      // Auto-prefix https:// for bare www. links so the browser navigates correctly
      const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          className={`underline underline-offset-2 font-semibold transition-opacity hover:opacity-80 active:opacity-60 ${
            isMine ? "text-black/80 decoration-black/40" : "text-[#00F0A0] decoration-[#00F0A0]/40"
          }`}
        >
          {part}
        </a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
};

const areReactionsEqual = (r1?: Message["reactions"], r2?: Message["reactions"]) => {
  if (!r1 && !r2) return true;
  if (!r1 || !r2) return false;
  const keys1 = Object.keys(r1);
  const keys2 = Object.keys(r2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    const arr1 = r1[key] || [];
    const arr2 = r2[key] || [];
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
  }
  return true;
};

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  id,
  content,
  type,
  mediaUrl,
  createdAt,
  formattedTime,
  isMine,
  senderNickname,
  senderAvatar,
  reactions,
  deliveryStatus,
  clientMessageId,
  swipeOffset,
  replyToContent,
  replyToSender,
  isForwarded,
  currentUserId,
  senderId,
  onPeerClick,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
  onToggleReaction,
  onRetryMessage,
  onImageLoad,
  onImageClick,
  mediaMetadata,
  isPinned,
}) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Veilo Performance] Render MessageBubble: ${id} | content: ${content.substring(0, 15)}`);
  }

  // Reconstruct lightweight message structure for callbacks
  const msgObj = React.useMemo(() => ({
    id,
    content,
    type,
    media_url: mediaUrl,
    created_at: createdAt,
    sender_id: senderId,
    sender_nickname: senderNickname,
    sender_avatar: senderAvatar,
    reactions,
    delivery_status: deliveryStatus,
    client_message_id: clientMessageId,
    reply_to_content: replyToContent,
    reply_to_sender_nickname: replyToSender,
    is_forwarded: isForwarded,
  }), [
    id, content, type, mediaUrl, createdAt, senderId,
    senderNickname, senderAvatar, reactions, deliveryStatus,
    clientMessageId, replyToContent, replyToSender, isForwarded
  ]);

  const threshold = 54;
  const isTriggered = swipeOffset >= threshold;

  useEffect(() => {
    if (isTriggered && typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(12);
      } catch (e) {}
    }
  }, [isTriggered]);

  if (type === "system") {
    const isClickable = senderId && senderId !== currentUserId && senderNickname;

    return (
      <div className="flex justify-center my-2 select-none animate-in fade-in duration-300">
        <button
          type="button"
          disabled={!isClickable}
          onClick={() => {
            if (isClickable && onPeerClick) {
              onPeerClick(senderId, senderNickname, senderAvatar || "👤");
            }
          }}
          className={`px-3.5 py-1 bg-zinc-900/60 text-[9px] font-black text-zinc-500 border border-zinc-900 rounded-full tracking-wider uppercase font-sans shadow-sm transition-all ${
            isClickable
              ? "cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-300 hover:border-zinc-800 active:scale-95 duration-100"
              : ""
          }`}
        >
          {content}
        </button>
      </div>
    );
  }

  // Calculate layout aspect ratio for media layout stabilization
  const width = mediaMetadata?.width;
  const height = mediaMetadata?.height;
  const aspectRatio = mediaMetadata?.aspect_ratio || (width && height ? width / height : undefined);

  return (
    <div
      className={`flex items-end h-fit gap-2.5 group animate-in fade-in slide-in-from-bottom-2 duration-300 relative ${
        isMine ? "justify-end" : "justify-start"
      }`}
      data-testid="message-bubble"
      data-message-id={id}
      data-delivery-status={deliveryStatus}
    >

      {/* Peer avatar */}
      {!isMine && (
        <button
          type="button"
          onClick={() => onPeerClick(senderId, senderNickname || "Anonymous Student", senderAvatar || "👤")}
          className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800/80 hover:border-zinc-700 active:scale-95 duration-150 transition-all flex items-center justify-center text-base shadow-sm self-end mb-1 cursor-pointer select-none"
        >
          {senderAvatar}
        </button>
      )}

      <div className={`flex flex-col h-fit gap-1 max-w-[75%] min-w-0 ${isMine ? "items-end" : "items-start"}`}>
        {isPinned && (
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider font-sans flex items-center gap-0.5 ml-1 select-none mb-0.5" data-testid="pinned-badge">
            📌 Pinned
          </span>
        )}
        {/* Peer user nickname */}
        {!isMine && (
          <button
            type="button"
            onClick={() => onPeerClick(senderId, senderNickname || "Anonymous Student", senderAvatar || "👤")}
            className="text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors ml-1 font-sans cursor-pointer text-left focus:outline-none"
          >
            {senderNickname}
          </button>
        )}

        {/* Relative wrapper for bubble and swipe indicator */}
        <div className="relative max-w-full">
          {/* Swipe Reply indicator */}
          {swipeOffset > 0 && (
            <div
              style={{
                transform: `translate3d(${Math.min(swipeOffset - 36, 0)}px, -50%, 0) scale(${Math.min(swipeOffset / threshold, 1.1)})`,
                opacity: Math.min(swipeOffset / 30, 1),
                transition: swipeOffset === 0 ? "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s" : "none",
              }}
              className={`absolute right-full mr-2.5 top-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-0 ${
                isTriggered
                  ? "bg-[#00F0A0] text-black shadow-[0_0_10px_rgba(0,240,160,0.4)]"
                  : "bg-zinc-800/80 border border-zinc-700 text-zinc-400"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${isTriggered ? "scale-110 rotate-[-12deg]" : ""}`}
              >
                <polyline points="9 17 4 12 9 7" />
                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
              </svg>
            </div>
          )}

          {/* Message bubble core */}
          <div
            onPointerDown={(event) => onPointerDown(event, msgObj)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(msgObj)}
            onPointerCancel={() => onPointerCancel(msgObj)}
            onContextMenu={(event) => {
              event.preventDefault();
              onContextMenu(event as any, msgObj);
            }}
            style={{
              transform: `translate3d(${swipeOffset}px, 0, 0)`,
              transition: swipeOffset === 0 ? "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none",
            }}
            className={`p-3.5 rounded-2xl relative cursor-pointer transition-transform touch-pan-y select-none active:scale-[0.98] max-w-full z-10 ${
            type === "text" && isEmojiOnly(content)
              ? "bg-transparent shadow-none border-none !p-1 text-white"
              : isMine
              ? "bg-[#00F0A0] text-black font-semibold rounded-tr-none shadow-md"
              : "bg-[#12121A] text-zinc-100 border border-zinc-900 rounded-tl-none shadow-md"
          }`}
          data-testid="message-content"
          data-message-mine={isMine}
        >
          {isForwarded && (
            <div className="flex items-center gap-1 mb-1.5 opacity-60">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isMine && !(type === "text" && isEmojiOnly(content)) ? "text-black" : "text-zinc-400"}
              >
                <polyline points="15 17 20 12 15 7" />
                <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
              </svg>
              <span className={`text-[9px] font-black uppercase tracking-wider ${isMine && !(type === "text" && isEmojiOnly(content)) ? "text-black/80" : "text-zinc-500"}`}>
                Forwarded
              </span>
            </div>
          )}

          {replyToContent && (
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
                {replyToSender || "Anonymous Student"}
              </span>
              <span className="block text-[11px] leading-snug truncate opacity-80">
                {replyToContent}
              </span>
            </button>
          )}

          {type === "image" && mediaUrl ? (
            <div 
              style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
              className="relative rounded-lg overflow-hidden max-w-full my-1 border border-zinc-850 bg-zinc-950/40 min-w-[200px]"
              onClick={(e) => {
                e.stopPropagation();
                if (swipeOffset === 0 && onImageClick) {
                  onImageClick(mediaUrl);
                }
              }}
            >
              <img
                src={mediaUrl}
                alt="Shared Media"
                className="max-h-[300px] object-contain w-full rounded-lg cursor-zoom-in active:scale-95 transition-transform duration-150"
                loading="lazy"
                onLoad={onImageLoad}
              />
              {content && content !== "Photo" && (
                <p 
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                  className="text-[14px] leading-relaxed font-sans mt-2"
                >
                  {parseTextWithLinks(content, isMine)}
                </p>
              )}
            </div>
          ) : (
            <p 
              style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
              className={`leading-relaxed font-sans ${
                type === "text" && isEmojiOnly(content)
                  ? "text-[32px] md:text-[36px]"
                  : "text-[14px]"
              }`}
            >
              {type === "text" && isEmojiOnly(content) ? content : parseTextWithLinks(content, isMine)}
            </p>
          )}
        </div>
      </div>

      {/* Reactions List */}
        {reactions && Object.keys(reactions).length > 0 && (
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {Object.entries(reactions).map(([emoji, userIds]) => {
              if (!userIds || userIds.length === 0) return null;
              const userReacted = userIds.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => onToggleReaction(id, emoji)}
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

        {/* Footer timestamp & status flags */}
        <div className="flex items-center gap-1 mt-0.5 px-1 select-none">
          <span className="text-[9px] text-zinc-600 font-sans tracking-wide">
            {formattedTime || new Date(createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isMine && (
            <>
              {deliveryStatus === "sending" && (
                <span className="text-[9px] text-zinc-600 font-sans">sending</span>
              )}
              {deliveryStatus === "failed" && clientMessageId && (
                <button
                  type="button"
                  onClick={() => onRetryMessage(clientMessageId)}
                  className="text-[9px] text-[#FF4B72] font-bold font-sans cursor-pointer"
                >
                  retry
                </button>
              )}
              {deliveryStatus !== "sending" && deliveryStatus !== "failed" && (
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
};

export const MessageBubble = memo(MessageBubbleComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.content === next.content &&
    prev.type === next.type &&
    prev.mediaUrl === next.mediaUrl &&
    prev.createdAt === next.createdAt &&
    prev.formattedTime === next.formattedTime &&
    prev.isMine === next.isMine &&
    prev.senderNickname === next.senderNickname &&
    prev.senderAvatar === next.senderAvatar &&
    prev.swipeOffset === next.swipeOffset &&
    prev.deliveryStatus === next.deliveryStatus &&
    prev.clientMessageId === next.clientMessageId &&
    prev.replyToContent === next.replyToContent &&
    prev.replyToSender === next.replyToSender &&
    prev.isForwarded === next.isForwarded &&
    prev.currentUserId === next.currentUserId &&
    prev.senderId === next.senderId &&
    prev.isPinned === next.isPinned &&
    // Check custom reactions map
    areReactionsEqual(prev.reactions, next.reactions)
  );
});
