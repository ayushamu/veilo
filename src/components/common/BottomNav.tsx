"use client";

import Link from "next/link";

interface BottomNavProps {
  activeTab: "chats" | "discover" | "profile";
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <nav className="bg-[#12121A] border-t border-zinc-900/60 fixed bottom-0 left-50% -translate-x-50% w-full max-w-[480px] z-50 shadow-[0_-8px_32px_rgba(0,0,0,0.8)] pb-safe">
      <div className="flex justify-around items-center py-3.5 px-4 select-none">
        
        {/* Chats Tab */}
        <Link
          href="/chats"
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 active:scale-95 ${
            activeTab === "chats"
              ? "text-[#00F0A0]"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          {/* Chat Bubble SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={activeTab === "chats" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-[10px] font-bold tracking-wider font-sans">Chats</span>
        </Link>

        {/* Discover Tab */}
        <Link
          href="/discover"
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 active:scale-95 ${
            activeTab === "discover"
              ? "text-[#00F0A0]"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          {/* Globe/Compass Discover SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={activeTab === "discover" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span className="text-[10px] font-bold tracking-wider font-sans">Discover</span>
        </Link>

        {/* Profile Tab */}
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 active:scale-95 ${
            activeTab === "profile"
              ? "text-[#00F0A0]"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          {/* User Person SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={activeTab === "profile" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-[10px] font-bold tracking-wider font-sans">Profile</span>
        </Link>

      </div>
    </nav>
  );
}
