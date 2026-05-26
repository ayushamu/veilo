"use client";

import React, { useState, useEffect } from "react";
import { postConfession } from "@/app/actions/confessions";
import { CONFESSION_GRADIENTS } from "./ConfessionCard";

const MOOD_EMOJIS = [
  "💭", "🤫", "💀", "👀", "💔", "❤️", "🔥", "😂",
  "😭", "🤯", "😴", "🥳", "🤔", "🙄", "🤡", "🎓",
  "🪐", "🍿", "🚀", "✨", "🍷", "🥀", "🌙", "🌧️"
];

interface PostWhisperSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (confession: {
    id: string;
    content: string;
    mood_emoji: string;
    gradient_id: number;
    allow_dm: boolean;
    created_at: string;
    profile_id: string;
    poster_nickname: string;
    poster_avatar: string;
    reactions: [];
    total_reactions: number;
  }) => void;
  currentNickname: string;
  currentAvatar: string;
  currentUserId: string;
}

export default function PostWhisperSheet({
  isOpen,
  onClose,
  onPostCreated,
  currentNickname,
  currentAvatar,
  currentUserId,
}: PostWhisperSheetProps) {
  const [content, setContent] = useState("");
  const [moodEmoji, setMoodEmoji] = useState("💭");
  const [gradientId, setGradientId] = useState(0);
  const [allowDm, setAllowDm] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Prevent scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length === 0) {
      setErrorMessage("Write something down first!");
      return;
    }
    if (content.length > 280) {
      setErrorMessage("Confessions must be 280 characters or less");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await postConfession(content, moodEmoji, gradientId, allowDm);

      if (response.success && response.data) {
        // Construct optimistic locally-rendered confession to insert at the top of my list immediately
        onPostCreated({
          id: response.data.id,
          content: content.trim(),
          mood_emoji: moodEmoji,
          gradient_id: gradientId,
          allow_dm: allowDm,
          created_at: new Date().toISOString(),
          profile_id: currentUserId,
          poster_nickname: currentNickname,
          poster_avatar: currentAvatar,
          reactions: [],
          total_reactions: 0,
        });

        // Reset
        setContent("");
        setMoodEmoji("💭");
        setGradientId(0);
        setAllowDm(true);
        onClose();
      } else {
        setErrorMessage(response.message || "Failed to share confession.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Sheet Content */}
      <div
        className="w-full max-w-[480px] bg-[#0E0E15] border-t border-zinc-800/80 rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.9)] z-10 flex flex-col max-h-[92vh] overflow-hidden transition-all duration-300 animate-slide-up"
        style={{
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Drag/Pull Bar indicator */}
        <div className="flex justify-center py-3 flex-shrink-0 cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
        </div>

        {/* Title */}
        <div className="px-6 pb-2 flex items-center justify-between border-b border-zinc-900/60 flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Whisper a Confession</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">
              Accessible globally on campus
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 pb-12">
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-900/40 text-red-400 rounded-xl text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Step 1: Pick Gradient */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              1. Choose a Background Style
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {CONFESSION_GRADIENTS.map((gradient, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setGradientId(index)}
                  className={`h-11 rounded-xl bg-gradient-to-br ${gradient} border transition-all relative overflow-hidden active:scale-95 duration-100 cursor-pointer ${
                    gradientId === index
                      ? "ring-2 ring-[#00F0A0] scale-[1.03] border-transparent"
                      : "border-transparent"
                  }`}
                >
                  {gradientId === index && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0] flex items-center justify-center shadow-[0_0_8px_rgba(0,240,160,0.6)]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="black"
                          strokeWidth="4.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Pick Mood Emoji */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>2. Choose Mood Emoji</span>
              <span className="text-lg bg-zinc-900 px-2.5 py-0.5 rounded-md text-white font-bold select-none border border-zinc-800/40">
                {moodEmoji}
              </span>
            </label>
            <div className="flex flex-wrap gap-2.5 max-h-[120px] overflow-y-auto p-1.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl select-none">
              {MOOD_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setMoodEmoji(emoji)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-100 cursor-pointer active:scale-90 ${
                    moodEmoji === emoji
                      ? "bg-[#00F0A0]/15 text-[#00F0A0] ring-1 ring-[#00F0A0]/40 scale-[1.05]"
                      : "hover:bg-zinc-900 text-zinc-300"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Write Text */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                3. Your Confession
              </label>
              <span
                className={`text-[10px] font-bold font-sans ${
                  content.length > 250 ? "text-amber-500" : "text-zinc-500"
                }`}
              >
                {content.length}/280
              </span>
            </div>
            <div className="relative">
              {/* Preview Gradient Block wrapper */}
              <div
                className={`w-full rounded-2xl bg-gradient-to-br ${CONFESSION_GRADIENTS[gradientId]} border border-white/5 p-5 shadow-inner transition-all duration-300`}
              >
                <div className="absolute top-4 left-4 text-2xl bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center pointer-events-none select-none">
                  {moodEmoji}
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={280}
                  className="w-full bg-transparent border-0 text-white placeholder:text-white/40 focus:ring-0 focus:outline-none text-base md:text-lg font-bold tracking-wide leading-relaxed text-center min-h-[120px] resize-none pr-1 mt-4"
                  placeholder="What is happening on campus? Type it here anonymously..."
                />
                <div className="mt-4 flex items-center gap-1.5 pointer-events-none select-none border-t border-white/5 pt-3">
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                    {currentAvatar}
                  </span>
                  <span className="text-[10px] font-bold text-white/70">
                    {currentNickname} (Preview)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DM Switch */}
          <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-900 p-4 rounded-2xl">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-bold text-white tracking-tight">Allow DM Replies</span>
              <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                Other students can slide to reply and message you anonymously
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowDm}
                onChange={(e) => setAllowDm(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:bg-black peer-checked:bg-[#00F0A0] peer-checked:after:border-[#00F0A0]" />
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || content.trim().length === 0}
            className="w-full py-4 rounded-full bg-[#00F0A0] text-black font-black text-sm tracking-widest uppercase hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none shadow-[0_4px_20px_rgba(0,240,160,0.25)] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-4 w-4 text-black"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Publishing...
              </>
            ) : (
              "Whisper Confession 🤫"
            )}
          </button>
        </form>
      </div>

      {/* Slide Up animation style */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
