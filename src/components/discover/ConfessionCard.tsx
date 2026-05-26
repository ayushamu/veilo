"use client";

import React from "react";
import { Confession } from "@/app/actions/confessions";

// Export the gradients so other components (like the composer sheet) can use them
export const CONFESSION_GRADIENTS = [
  "from-[#1E1E38] to-[#0F0F1E] border-violet-950/40",    // 0: Midnight
  "from-[#1A1C3A] to-[#3B154C] border-purple-950/40",    // 1: Deep Purple
  "from-[#0E2A1E] to-[#1E4D2B] border-emerald-950/40",   // 2: Forest
  "from-[#4A0E4E] to-[#6C3E70] border-pink-950/40",      // 3: Lavender
  "from-[#521C00] to-[#8C3A00] border-orange-950/40",    // 4: Ember
  "from-[#042037] to-[#0A4D68] border-sky-950/40",       // 5: Ocean
  "from-[#1C1D21] to-[#3A3F47] border-zinc-800/40",      // 6: Slate
  "from-[#380E0E] to-[#5C1A1A] border-red-950/40",       // 7: Crimson
];

interface ConfessionCardProps {
  confession: Confession;
  isTop: boolean;
  style?: React.CSSProperties;
  onReactClick?: (emoji: string) => void;
  onReplyClick?: () => void;
  dragXRef?: React.RefObject<number>; // Optional Ref to track drag in real time
}

export default function ConfessionCard({
  confession,
  isTop,
  style,
  onReactClick,
  onReplyClick,
}: ConfessionCardProps) {
  const gradientClass =
    CONFESSION_GRADIENTS[confession.gradient_id] || CONFESSION_GRADIENTS[0];

  // Helper to format time ago
  const formatTimeAgo = (dateStr: string) => {
    try {
      const past = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  // Find if current user has reacted to this confession
  const myReaction = confession.reactions.find((r) => r.reactedByMe);

  return (
    <div
      style={style}
      className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${gradientClass} border shadow-2xl flex flex-col p-6 overflow-hidden select-none transition-shadow duration-300 ${
        isTop ? "shadow-black/50 z-20 cursor-grab active:cursor-grabbing" : "z-10 shadow-black/20"
      }`}
    >
      {/* Glow effect at the top */}
      <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      {/* Card Header: Mood emoji and time */}
      <div className="flex items-center justify-between pointer-events-none">
        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/5">
          {confession.mood_emoji}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/5 text-[10px] font-bold text-zinc-400">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          {formatTimeAgo(confession.created_at)}
        </div>
      </div>

      {/* Card Content: The confession text */}
      <div className="flex-1 flex flex-col justify-center py-6 overflow-y-auto min-h-0 select-text">
        <p className="text-xl md:text-2xl font-bold text-white tracking-wide leading-relaxed text-center break-words max-h-full overflow-y-auto pr-1">
          &ldquo;{confession.content}&rdquo;
        </p>
      </div>

      {/* Card Footer: Poster avatar/nickname & Reactions summary */}
      <div className="mt-auto space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          {/* User info */}
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg select-none">
              {confession.poster_avatar}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white font-heading">
                {confession.poster_nickname}
              </span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">
                Student Poster
              </span>
            </div>
          </div>

          {/* DM Indicator */}
          {confession.allow_dm && onReplyClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReplyClick();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer border border-white/5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              DM
            </button>
          )}
        </div>

        {/* Reactions Summary */}
        {confession.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 select-none">
            {confession.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReactClick?.(reaction.emoji);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                  reaction.reactedByMe
                    ? "bg-[#00F0A0]/15 text-[#00F0A0] border-[#00F0A0]/35 shadow-[0_0_8px_rgba(0,240,160,0.1)]"
                    : "bg-white/5 text-zinc-300 border-white/5 hover:bg-white/10"
                }`}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Swipe Overlays (Hidden by default, manipulated via CSS opacity on drag) */}
      <div
        id="swipe-like-overlay"
        className="absolute inset-0 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-3xl flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-100"
      >
        <div className="bg-emerald-500 text-white font-black text-2xl tracking-widest uppercase px-6 py-3 rounded-2xl rotate-[-12deg] shadow-lg shadow-emerald-950/20 flex items-center gap-2">
          <span>❤️</span> REACT
        </div>
      </div>

      <div
        id="swipe-skip-overlay"
        className="absolute inset-0 bg-red-500/10 border-2 border-red-500/30 rounded-3xl flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-100"
      >
        <div className="bg-red-500 text-white font-black text-2xl tracking-widest uppercase px-6 py-3 rounded-2xl rotate-[12deg] shadow-lg shadow-red-950/20 flex items-center gap-2">
          <span>✕</span> SKIP
        </div>
      </div>
    </div>
  );
}
