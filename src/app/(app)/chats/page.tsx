"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "@/components/common/BottomNav";
import { useInboxStore } from "@/hooks/use-inbox-store";
import { useChatHistoryStore } from "@/store/chat-history-store";
import { VeiloAvatar } from "@/components/avatar/VeiloAvatar";
import { createClient } from "@/lib/supabase/client";

export default function ChatsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { rooms, loadingInitial, refreshing } = useInboxStore();
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);

  useEffect(() => {
    const checkAvatarConfig = async () => {
      if (typeof window === "undefined") return;
      // Check if user has already dismissed this banner
      const dismissed = localStorage.getItem("veilo:avatar-prompt-dismissed");
      if (dismissed === "true") return;

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_config")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        const config = profile.avatar_config || {};
        // If avatar_config is empty, show the banner!
        if (Object.keys(config).length === 0) {
          setShowAvatarPrompt(true);
        }
      }
    };

    checkAvatarConfig();
  }, []);

  const dismissPrompt = () => {
    localStorage.setItem("veilo:avatar-prompt-dismissed", "true");
    setShowAvatarPrompt(false);
  };

  const handleRoomPointerDown = (roomId: string, event: React.PointerEvent) => {
    if (typeof window !== "undefined" && window.performance) {
      try {
        performance.clearMarks("veilo-pointerdown");
        performance.clearMeasures("veilo-tap-to-content");
        performance.mark("veilo-pointerdown");
      } catch (e) {}
    }

    const startX = event.clientX;
    const startY = event.clientY;
    let isCancelled = false;

    const timer = setTimeout(() => {
      if (!isCancelled) {
        useChatHistoryStore.getState().prewarmRoom(roomId);
      }
    }, 70);

    const onPointerMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
        cleanup();
      }
    };

    const cleanup = () => {
      isCancelled = true;
      clearTimeout(timer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", cleanup, { passive: true });
    window.addEventListener("pointercancel", cleanup, { passive: true });
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shouldShowBlockingLoader = loadingInitial && rooms.length === 0;

  return (
    <main className="flex-1 flex flex-col bg-[#08080C] h-full pb-24">
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

      {/* Avatar Customization Promo Banner */}
      {showAvatarPrompt && (
        <div className="mx-6 mb-3 p-4 rounded-2xl bg-gradient-to-r from-[#12121A] to-[#181824] border border-[#00F0A0]/20 flex items-start justify-between gap-3 shadow-[0_4px_20px_rgba(0,240,160,0.05)] relative overflow-hidden animate-fade-in shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F0A0]/5 blur-2xl rounded-full" />
          <div className="flex-1 space-y-1.5 z-10">
            <h4 className="text-xs font-black text-[#00F0A0] uppercase tracking-wider font-sans flex items-center gap-1.5">
              <span>✨</span> Style Your Identity
            </h4>
            <p className="text-[11px] text-zinc-300 font-medium leading-relaxed font-sans">
              Personalize your premium anonymous avatar to unlock your unique look in campus discussions!
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#00F0A0] hover:text-[#00D090] pt-1 active:scale-95 transition-transform"
            >
              Design Avatar 🎨
            </Link>
          </div>
          <button
            onClick={dismissPrompt}
            className="p-1 rounded-full text-zinc-500 hover:text-white active:scale-95 transition-all z-10 shrink-0"
            title="Dismiss"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

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
              onPointerDown={(e) => handleRoomPointerDown(room.id, e)}
              className="flex items-center justify-between p-3.5 hover:bg-[#12121A]/30 active:bg-[#12121A]/50 transition-colors duration-150 rounded-2xl cursor-pointer mt-1"
              data-testid="room-item"
              data-roomid={room.id}
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full flex-shrink-0 bg-[#12121A] border border-zinc-800/80 flex items-center justify-center shadow-sm relative select-none overflow-hidden">
                  {room.id === "11111111-1111-1111-1111-111111111111" ? (
                    <div className="w-full h-full bg-[#12121A] border border-[#00F0A0]/20 flex items-center justify-center relative overflow-hidden select-none shrink-0">
                      <div className="absolute inset-0 bg-[#00F0A0]/5 blur-sm" />
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00F0A0"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5.5 h-5.5 relative z-10 drop-shadow-[0_0_6px_rgba(0,240,160,0.35)]"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                  ) : (
                    <VeiloAvatar
                      seed={room.name}
                      config={room.avatar_emoji && room.avatar_emoji.startsWith("{") ? room.avatar_emoji : null}
                      size={48}
                      className="border-0 shadow-none hover:border-0"
                    />
                  )}

                  {(room.id === "00000000-0000-0000-0000-000000000000" || 
                    room.id === "11111111-1111-1111-1111-111111111111") && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00BFFF] border-2 border-[#08080C] rounded-full shadow-[0_0_6px_rgba(0,191,255,0.6)] z-20" />
                  )}
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-white tracking-tight truncate pr-2 flex items-center gap-1.5">
                      <span className="truncate">{room.name}</span>
                      {(room.id === "00000000-0000-0000-0000-000000000000" || 
                        room.id === "11111111-1111-1111-1111-111111111111") && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4 text-[#00BFFF] shrink-0"
                        >
                          <title>Official Verified Channel</title>
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      )}
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
