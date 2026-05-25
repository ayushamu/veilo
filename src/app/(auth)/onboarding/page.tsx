"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ADJECTIVES, NOUNS, EMOJIS } from "@/lib/constants/identity";
import { submitOnboarding } from "@/app/actions/profile";

export default function OnboardingPage() {
  const router = useRouter();
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("");
  
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Shuffles a new identity based on gender
  const shuffleIdentity = (overrideGender?: "male" | "female" | "other") => {
    setAnimating(true);
    setErrorMsg("");

    setTimeout(() => {
      const activeGender = overrideGender || gender;
      const emojiPool = EMOJIS[activeGender];
      
      const randomAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      const randomEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];

      setNickname(`${randomAdj} ${randomNoun}`);
      setAvatar(randomEmoji);
      setAnimating(false);
    }, 250);
  };

  // Perform initial shuffle on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      shuffleIdentity("male");
    }, 0);

    return () => clearTimeout(timer);
    // Run once to seed the first anonymous identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenderChange = (selected: "male" | "female" | "other") => {
    if (selected === gender) return;
    setGender(selected);
    shuffleIdentity(selected);
  };

  const handleEnter = async () => {
    setLoading(true);
    setErrorMsg("");

    const res = await submitOnboarding(nickname, gender, avatar);
    setLoading(false);

    if (res.success) {
      router.push("/chats");
    } else {
      setErrorMsg(res.message || "Onboarding failed. Please try again.");
    }
  };

  return (
    <main className="flex-1 flex flex-col justify-between px-6 py-8 relative overflow-hidden bg-[#08080C] min-h-screen">
      {/* AppBar Header */}
      <header className="flex items-center justify-between border-b border-zinc-900/60 pb-4 w-full">
        <div className="w-8" /> {/* Balance spacer */}
        <h1 className="text-xl font-bold font-heading text-[#00F0A0] tracking-wider select-none">
          Veilo Onboarding
        </h1>
        <div className="w-8" />
      </header>

      {/* Hero Header */}
      <div className="text-center mt-6 mb-8 select-none">
        <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2">
          Who are you today?
        </h2>
        <p className="text-sm text-zinc-400 font-sans leading-relaxed">
          Pick a gender to generate your unique anonymous identity.
        </p>
      </div>

      {/* Identity Visualizer Area */}
      <div className="relative w-full flex flex-col items-center my-auto">
        {/* Background Decorative Glow Ring */}
        <div className="absolute -z-10 w-48 h-48 bg-[#00F0A0]/10 blur-[60px] rounded-full" />

        {/* Avatar Bubble */}
        <div
          className={`relative w-40 h-40 rounded-full bg-[#12121A]/70 backdrop-blur-xl flex items-center justify-center border border-zinc-800/80 shadow-[0_0_40px_rgba(0,240,160,0.15)] mb-6 transition-all duration-300 ${
            animating ? "scale-75 opacity-0 rotate-12" : "scale-100 opacity-100 rotate-0"
          }`}
        >
          <span className="text-7xl select-none">{avatar}</span>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 rounded-full pointer-events-none" />
        </div>

        {/* Nickname and Badges */}
        <div className="text-center space-y-1">
          <span className="inline-block px-3 py-1 bg-[#12121A] rounded-full border border-zinc-800/60 shadow-sm select-none">
            <span className="text-[10px] font-bold font-sans text-[#00F0A0] tracking-widest uppercase">
              Identity Link
            </span>
          </span>
          <h3 className="text-2xl font-extrabold font-heading text-white tracking-tight">
            {nickname}
          </h3>
        </div>

        {/* Shuffle Identity Trigger */}
        <button
          onClick={() => shuffleIdentity()}
          disabled={animating}
          className="mt-4 flex items-center gap-2 text-[#00F0A0] hover:bg-[#00F0A0]/10 border border-[#00F0A0]/20 active:border-[#00F0A0]/40 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50 select-none"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${animating ? "animate-spin" : ""}`}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Shuffle Identity
        </button>
      </div>

      {/* Gender Tab Selection */}
      <div className="w-full space-y-6 mt-8">
        <div className="grid grid-cols-3 gap-3 w-full">
          <button
            onClick={() => handleGenderChange("male")}
            className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-[#12121A]/50 border transition-all duration-200 cursor-pointer active:scale-95 ${
              gender === "male"
                ? "border-[#00F0A0] bg-[#00F0A0]/5 shadow-[0_0_20px_rgba(0,240,160,0.08)]"
                : "border-zinc-900 hover:border-zinc-800"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                gender === "male" ? "bg-[#00F0A0]/20 text-[#00F0A0]" : "bg-[#08080C] text-zinc-500"
              }`}
            >
              {/* Male SVG */}
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
                <circle cx="10" cy="14" r="6" />
                <path d="M18 2h4v4M14 10l8-8" />
              </svg>
            </div>
            <span
              className={`text-xs font-bold font-sans ${
                gender === "male" ? "text-white" : "text-zinc-500"
              }`}
            >
              Male
            </span>
          </button>

          <button
            onClick={() => handleGenderChange("female")}
            className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-[#12121A]/50 border transition-all duration-200 cursor-pointer active:scale-95 ${
              gender === "female"
                ? "border-[#00F0A0] bg-[#00F0A0]/5 shadow-[0_0_20px_rgba(0,240,160,0.08)]"
                : "border-zinc-900 hover:border-zinc-800"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                gender === "female" ? "bg-[#00F0A0]/20 text-[#00F0A0]" : "bg-[#08080C] text-zinc-500"
              }`}
            >
              {/* Female SVG */}
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
                <circle cx="12" cy="8" r="6" />
                <path d="M12 14v8M9 18h6" />
              </svg>
            </div>
            <span
              className={`text-xs font-bold font-sans ${
                gender === "female" ? "text-white" : "text-zinc-500"
              }`}
            >
              Female
            </span>
          </button>

          <button
            onClick={() => handleGenderChange("other")}
            className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-[#12121A]/50 border transition-all duration-200 cursor-pointer active:scale-95 ${
              gender === "other"
                ? "border-[#00F0A0] bg-[#00F0A0]/5 shadow-[0_0_20px_rgba(0,240,160,0.08)]"
                : "border-zinc-900 hover:border-zinc-800"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                gender === "other" ? "bg-[#00F0A0]/20 text-[#00F0A0]" : "bg-[#08080C] text-zinc-500"
              }`}
            >
              {/* Transgender SVG */}
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
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v4M12 18v4M4 12H2M22 12h-2M5.66 5.66l2.83 2.83M15.51 15.51l2.83 2.83M5.66 18.34l2.83-2.83M15.51 8.49l2.83-2.83" />
              </svg>
            </div>
            <span
              className={`text-xs font-bold font-sans ${
                gender === "other" ? "text-white" : "text-zinc-500"
              }`}
            >
              Other
            </span>
          </button>
        </div>

        {/* Action Button & Errors */}
        <div className="w-full space-y-4">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start gap-2.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF4B72"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 flex-shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-red-300 leading-normal font-sans">
                {errorMsg}
              </p>
            </div>
          )}

          <button
            onClick={handleEnter}
            disabled={loading}
            className="w-full bg-[#00F0A0] text-black font-semibold text-base py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-[0_4px_16px_rgba(0,240,160,0.2)] hover:shadow-[0_4px_24px_rgba(0,240,160,0.35)] disabled:opacity-60 disabled:cursor-not-allowed select-none"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-black"
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
                Creating identity...
              </>
            ) : (
              <>
                Enter Veilo
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
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-zinc-600 font-sans tracking-wide">
            Your anonymous identity is generated locally and can be shuffled.
          </p>
        </div>
      </div>
    </main>
  );
}
