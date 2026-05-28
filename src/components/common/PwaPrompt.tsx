"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePwa } from "@/hooks/use-pwa";

export default function PwaPrompt() {
  const { deferredPrompt, isStandalone, canInstall, triggerInstall } = usePwa();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (canInstall) {
      // Check if user has previously dismissed the prompt in this session
      const dismissed = sessionStorage.getItem("pwa_dismissed");
      if (!dismissed) {
        // Show the prompt with a natural delay
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [canInstall]);

  const handleInstallClick = async () => {
    const success = await triggerInstall();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    // Store in sessionStorage so it doesn't prompt again during this active session
    sessionStorage.setItem("pwa_dismissed", "true");
    setShowPrompt(false);
  };

  // If already installed or prompt shouldn't show, render nothing
  if (isStandalone || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-all duration-300 animate-fadeIn">
      {/* Glow highlight */}
      <div className="absolute w-[280px] h-[280px] bg-[#00F0A0]/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Dialog container */}
      <div className="relative w-full max-w-sm bg-[#12121A]/90 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center overflow-hidden">
        {/* Border accent */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[#00F0A0] to-transparent" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
          aria-label="Close"
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* App Icon */}
        <div className="relative w-20 h-20 mb-5 mt-2 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(0,240,160,0.15)] border border-zinc-700/50">
          <Image
            src="/icon-512.png"
            alt="Veilo Icon"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* App Information */}
        <h3 className="text-xl font-bold font-heading text-white tracking-tight mb-2">
          Install Veilo App
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6 px-2">
          Experience Veilo as a premium fullscreen app. Get instant notifications, smoother animations, and immediate home screen access.
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleInstallClick}
            className="w-full bg-[#00F0A0] text-black font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,240,160,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer"
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Add to Home Screen
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full bg-transparent hover:bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 font-semibold py-2.5 rounded-xl transition-all duration-200 text-sm cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
