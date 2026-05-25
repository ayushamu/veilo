"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/common/BottomNav";
import { useInboxStore } from "@/hooks/use-inbox-store";

export default function ChatsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { rooms, loadingInitial, refreshing } = useInboxStore();

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shouldShowBlockingLoader = loadingInitial && rooms.length === 0;

  return (
    <main className="flex-1 flex flex-col bg-[#08080C] min-h-screen pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#08080C]/85 backdrop-blur-md border-b border-zinc-900/60 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-extrabold font-heading text-white tracking-tight">
            Veilo
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 bg-[#00F0A0] rounded-full shadow-[0_0_8px_rgba(0,240,160,0.6)] animate-pulse" />
            <span className="text-[10px] font-bold text-zinc-500 tracking-wide uppercase font-sans">
              Campus Online
            </span>
            {refreshing && rooms.length > 0 && (
              <span className="text-[10px] font-bold text-zinc-700 tracking-wide uppercase font-sans">
                Syncing
              </span>
            )}
          </div>
        </div>

        <button className="text-zinc-400 hover:text-white transition-colors p-2 rounded-full active:scale-95 duration-150 cursor-pointer">
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
      </header>

      {/* Search Input Filter */}
      <div className="px-6 pt-4 pb-2">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-[#00F0A0] transition-colors">
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
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#12121A]/70 border border-zinc-900 focus:border-zinc-800/80 text-white font-sans text-sm rounded-full py-3.5 pl-11 pr-4 focus:ring-4 focus:ring-[#00F0A0]/5 focus:outline-none transition-all placeholder:text-zinc-600 shadow-inner"
            placeholder="Search anonymous rooms..."
          />
        </div>
      </div>

      {/* Rooms List Section */}
      <section className="flex-1 overflow-y-auto px-4 mt-2 divide-y divide-zinc-900/40">
        {shouldShowBlockingLoader ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="animate-spin h-8 w-8 text-[#00F0A0] mb-4"
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
            <p className="text-zinc-500 text-xs">Syncing with campus rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-zinc-600 text-sm font-sans">No matching active rooms found.</p>
          </div>
        ) : (
          filteredRooms.map((room) => (
            <Link
              key={room.id}
              href={`/chats/${room.id}`}
              className="flex items-center justify-between p-3.5 hover:bg-[#12121A]/30 active:bg-[#12121A]/50 transition-colors duration-150 rounded-2xl cursor-pointer mt-1"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800/80 flex items-center justify-center text-2xl shadow-sm relative select-none">
                  {room.avatar_emoji}

                  {room.id === "00000000-0000-0000-0000-000000000000" && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00F0A0] border-2 border-[#08080C] rounded-full shadow-[0_0_6px_rgba(0,240,160,0.6)]" />
                  )}
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-white tracking-tight truncate pr-2">
                      {room.name}
                    </h2>
                    <span className="text-[10px] text-zinc-500 font-sans whitespace-nowrap">
                      {room.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 font-sans truncate mt-1">
                    {room.isMuted ? "Muted · " : ""}
                    {room.lastMessage}
                  </p>
                </div>
              </div>

              {room.unreadCount > 0 && (
                <div className="ml-3.5 flex-shrink-0 bg-[#00F0A0] text-black text-[10px] font-black min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,240,160,0.25)] select-none">
                  {room.unreadCount > 99 ? "99+" : room.unreadCount}
                </div>
              )}
            </Link>
          ))
        )}
      </section>

      <BottomNav activeTab="chats" />
    </main>
  );
}
