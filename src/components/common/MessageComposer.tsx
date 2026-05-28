"use client";

import { useEffect, useState, useRef } from "react";
import { type ReplyDraft } from "@/hooks/use-chat";

interface MessageComposerProps {
  onSend: (content: string) => void;
  onAttachImage: () => void;
  onAttachCamera: () => void;
  setTypingStatus: (isTyping: boolean) => void;
  replyingTo: ReplyDraft | null;
  onCancelReply: () => void;
}

const POPULAR_EMOJIS = [
  "😂", "❤️", "👍", "🔥", "😍", "😭", "😊", "🙏",
  "🤔", "💀", "🤣", "🥺", "👀", "😮", "👏", "🎉",
  "🥳", "💯", "🤫", "🤡", "🫠", "🧐", "😎", "🙄",
  "😢", "😡", "💩", "💡", "📌", "🚀", "✨", "📱"
];

export default function MessageComposer({
  onSend,
  onAttachImage,
  onAttachCamera,
  setTypingStatus,
  replyingTo,
  onCancelReply,
}: MessageComposerProps) {
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputText.trim();
      if (!trimmed) return;
      onSend(trimmed);
      setInputText("");
      setShowEmojiPicker(false);
    }
  };

  // Debounced typing notifications
  useEffect(() => {
    if (!inputText) {
      setTypingStatus(false);
      return;
    }

    setTypingStatus(true);
    const delayDebounceFn = setTimeout(() => {
      setTypingStatus(false);
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText, setTypingStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setInputText("");
    setShowEmojiPicker(false);
  };

  return (
    <footer className="sticky bottom-0 left-0 right-0 p-4 bg-[#08080C]/90 backdrop-blur-xl border-t border-zinc-900/60 z-30">
      {/* Replying To preview header */}
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
                  onClick={onCancelReply}
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

      {/* Emoji Picker overlay */}
      {showEmojiPicker && (
        <div className="mb-3 bg-[#12121A]/95 border border-zinc-800 rounded-2xl shadow-xl p-3 z-45 animate-in slide-in-from-bottom-2 fade-in duration-150 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
              Popular Emojis
            </span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              className="text-zinc-500 hover:text-white text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                }}
                className="h-9 rounded-lg hover:bg-zinc-800/80 active:scale-90 transition-all flex items-center justify-center text-xl cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 w-full" data-testid="composer-form">
        {/* Media Attach button */}
        <button
          type="button"
          onClick={onAttachImage}
          className="w-11 h-11 rounded-full bg-[#12121A] border border-zinc-850 hover:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 duration-200 cursor-pointer shadow-sm shrink-0"
          title="Attach Image"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Camera Capture button */}
        <button
          type="button"
          onClick={onAttachCamera}
          className="w-11 h-11 rounded-full bg-[#12121A] border border-zinc-850 hover:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 duration-200 cursor-pointer shadow-sm shrink-0"
          title="Take Photo"
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
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        {/* Text Input area */}
        <div className="flex-1 bg-[#12121A]/70 border border-zinc-900 rounded-2xl flex items-end px-4 py-2.5 min-h-[44px] h-auto shadow-inner focus-within:border-zinc-850 transition-colors relative">
          <textarea
            ref={textareaRef}
            id="composer-input"
            rows={1}
            required
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="sentences"
            className="bg-transparent border-none text-white text-[14px] placeholder-zinc-650 w-full focus:ring-0 focus:outline-none font-sans pr-8 resize-none py-1 h-[24px] max-h-[120px] overflow-y-auto"
            placeholder="Message in anonymous room..."
            data-testid="composer-input"
          />
          {/* Emoji Trigger Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-3.5 bottom-3 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            title="Emojis"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
        </div>

        {/* Send FAB Button */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-11 h-11 rounded-full bg-[#00F0A0] text-black flex items-center justify-center shadow-[0_4px_16px_rgba(0,240,160,0.3)] disabled:opacity-40 disabled:shadow-none hover:scale-105 active:scale-90 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed shrink-0"
          data-testid="composer-send-button"
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
  );
}
