"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Confession,
  getNextConfessions,
  markConfessionSeen,
  reactToConfession,
  replyToConfession,
  getMyConfessions,
  deleteConfession,
} from "@/app/actions/confessions";
import ConfessionCard from "./ConfessionCard";
import PostWhisperSheet from "./PostWhisperSheet";
import BottomNav from "@/components/common/BottomNav";

interface DiscoverClientProps {
  initialConfessions: Confession[];
  currentUserId: string;
  currentNickname: string;
  currentAvatar: string;
}

export default function DiscoverClient({
  initialConfessions,
  currentUserId,
  currentNickname,
  currentAvatar,
}: DiscoverClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"deck" | "my-whispers">("deck");
  const [deck, setDeck] = useState<Confession[]>(initialConfessions);
  const [myConfessions, setMyConfessions] = useState<Confession[]>([]);
  const [loadingMyConfessions, setLoadingMyConfessions] = useState(false);
  const [isPostSheetOpen, setIsPostSheetOpen] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isReplying, setIsReplying] = useState<string | null>(null); // tracks loading DM reply state

  // Swipe gesture refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const swipeThreshold = 120; // px
  const isTransitioning = useRef(false);

  // Realtime subscription for confession reactions
  useEffect(() => {
    // Listen to confession reactions insert/update/delete to sync counts in real-time
    const channel = supabase
      .channel("realtime-confession-reactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "confession_reactions" },
        async (payload: any) => {
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;
          const eventType = payload.eventType;

          const targetConfessionId =
            eventType === "DELETE" ? oldRecord.confession_id : newRecord.confession_id;

          if (!targetConfessionId) return;

          // Fetch the updated reactions for this confession
          const { data: reactionRows } = await supabase
            .from("confession_reactions")
            .select("emoji, profile_id")
            .eq("confession_id", targetConfessionId);

          if (!reactionRows) return;

          // Aggregate new reaction structure
          const reactionMap = new Map<string, { count: number; reactedByMe: boolean }>();
          for (const r of reactionRows) {
            const existing = reactionMap.get(r.emoji) ?? { count: 0, reactedByMe: false };
            reactionMap.set(r.emoji, {
              count: existing.count + 1,
              reactedByMe: existing.reactedByMe || r.profile_id === currentUserId,
            });
          }

          const updatedReactions = Array.from(reactionMap.entries()).map(
            ([emoji, { count, reactedByMe }]) => ({
              emoji,
              count,
              reactedByMe,
            })
          );

          // Update deck confessions
          setDeck((prevDeck) =>
            prevDeck.map((c) =>
              c.id === targetConfessionId
                ? {
                    ...c,
                    reactions: updatedReactions,
                    total_reactions: reactionRows.length,
                  }
                : c
            )
          );

          // Update my confessions
          setMyConfessions((prevMy) =>
            prevMy.map((c) =>
              c.id === targetConfessionId
                ? {
                    ...c,
                    reactions: updatedReactions,
                    total_reactions: reactionRows.length,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId]);

  // Load My Confessions
  const loadMyConfessions = async () => {
    setLoadingMyConfessions(true);
    const res = await getMyConfessions();
    if (res.success && res.data) {
      setMyConfessions(res.data);
    }
    setLoadingMyConfessions(false);
  };

  useEffect(() => {
    if (activeTab === "my-whispers") {
      loadMyConfessions();
    }
  }, [activeTab]);

  // Load more confessions when deck runs low
  const fetchMore = async () => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);
    try {
      const res = await getNextConfessions(15);
      if (res.success && res.data && res.data.length > 0) {
        // Filter out any we already have in state
        const existingIds = new Set(deck.map((c) => c.id));
        const newConfessions = res.data.filter((c) => !existingIds.has(c.id));
        setDeck((prev) => [...prev, ...newConfessions]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Refresh feed with new confessions
  const handleRefresh = async () => {
    try {
      const res = await getNextConfessions(15);
      if (res.success && res.data && res.data.length > 0) {
        const existingIds = new Set(deck.map((c) => c.id));
        const newConfessions = res.data.filter((c) => !existingIds.has(c.id));
        
        if (newConfessions.length > 0) {
          setDeck((prev) => [...newConfessions, ...prev]);
          
          // Toast message
          const toast = document.createElement("div");
          toast.className =
            "fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#00F0A0] text-black px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg animate-fade-in-out flex items-center gap-2";
          toast.innerHTML = `<span>🔄</span> Loaded ${newConfessions.length} new whispers!`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2500);
        } else {
          // Toast: up to date
          const toast = document.createElement("div");
          toast.className =
            "fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-800 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg animate-fade-in-out flex items-center gap-2";
          toast.innerHTML = `<span>✨</span> Feed is up to date!`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Check if we need to fetch more
  useEffect(() => {
    if (deck.length < 5 && activeTab === "deck" && !isFetchingMore) {
      fetchMore();
    }
  }, [deck.length, activeTab]);

  // Pointer gesture handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isTransitioning.current || deck.length === 0) return;

    // Check if target is a button or clickable element on the card
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }

    isDragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = e.clientX;
    currentY.current = e.clientY;

    const topCard = containerRef.current?.querySelector(
      ".confession-card-0"
    ) as HTMLDivElement | null;
    if (topCard) {
      topCard.style.transition = "none";
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || deck.length === 0) return;

    currentX.current = e.clientX;
    currentY.current = e.clientY;

    const deltaX = currentX.current - startX.current;
    const deltaY = currentY.current - startY.current;

    const topCard = containerRef.current?.querySelector(
      ".confession-card-0"
    ) as HTMLDivElement | null;
    const card2 = containerRef.current?.querySelector(
      ".confession-card-1"
    ) as HTMLDivElement | null;
    const card3 = containerRef.current?.querySelector(
      ".confession-card-2"
    ) as HTMLDivElement | null;

    const likeOverlay = topCard?.querySelector("#swipe-like-overlay") as HTMLDivElement | null;
    const skipOverlay = topCard?.querySelector("#swipe-skip-overlay") as HTMLDivElement | null;

    // Move top card
    if (topCard) {
      topCard.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${
        deltaX * 0.08
      }deg)`;
    }

    // Scale up lower cards slightly as top card is dragged
    const dragProgress = Math.min(Math.abs(deltaX) / swipeThreshold, 1);

    if (card2) {
      const scale = 0.96 + dragProgress * 0.04;
      const translateY = 12 - dragProgress * 12;
      card2.style.transform = `scale(${scale}) translate3d(0, ${translateY}px, 0)`;
      card2.style.filter = `blur(${Math.max(1 - dragProgress, 0)}px)`;
    }

    if (card3) {
      const scale = 0.92 + dragProgress * 0.04;
      const translateY = 24 - dragProgress * 12;
      card3.style.transform = `scale(${scale}) translate3d(0, ${translateY}px, 0)`;
      card3.style.filter = `blur(${Math.max(2 - dragProgress * 2, 0)}px)`;
    }

    // Overlays opacity
    if (deltaX > 0) {
      if (likeOverlay) likeOverlay.style.opacity = `${dragProgress * 0.85}`;
      if (skipOverlay) skipOverlay.style.opacity = "0";
    } else {
      if (skipOverlay) skipOverlay.style.opacity = `${dragProgress * 0.85}`;
      if (likeOverlay) likeOverlay.style.opacity = "0";
    }
  };

  const handlePointerUp = () => {
    if (!isDragging.current || deck.length === 0) return;
    isDragging.current = false;

    const deltaX = currentX.current - startX.current;
    const topCard = containerRef.current?.querySelector(
      ".confession-card-0"
    ) as HTMLDivElement | null;

    if (deltaX > swipeThreshold) {
      triggerSwipeAnimation("right");
    } else if (deltaX < -swipeThreshold) {
      triggerSwipeAnimation("left");
    } else {
      // Snap back
      if (topCard) {
        topCard.style.transition =
          "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s";
        topCard.style.transform = "translate3d(0px, 0px, 0px) rotate(0deg)";

        const likeOverlay = topCard.querySelector("#swipe-like-overlay") as HTMLDivElement | null;
        const skipOverlay = topCard.querySelector("#swipe-skip-overlay") as HTMLDivElement | null;
        if (likeOverlay) likeOverlay.style.opacity = "0";
        if (skipOverlay) skipOverlay.style.opacity = "0";
      }

      // Reset lower cards back to static scaling
      const card2 = containerRef.current?.querySelector(
        ".confession-card-1"
      ) as HTMLDivElement | null;
      const card3 = containerRef.current?.querySelector(
        ".confession-card-2"
      ) as HTMLDivElement | null;

      if (card2) {
        card2.style.transition = "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        card2.style.transform = "scale(0.96) translate3d(0, 12px, 0)";
        card2.style.filter = "blur(1px)";
      }
      if (card3) {
        card3.style.transition = "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        card3.style.transform = "scale(0.92) translate3d(0, 24px, 0)";
        card3.style.filter = "blur(2px)";
      }
    }
  };

  const triggerSwipeAnimation = (direction: "left" | "right") => {
    if (deck.length === 0 || isTransitioning.current) return;
    isTransitioning.current = true;

    const topCard = containerRef.current?.querySelector(
      ".confession-card-0"
    ) as HTMLDivElement | null;
    const card2 = containerRef.current?.querySelector(
      ".confession-card-1"
    ) as HTMLDivElement | null;
    const card3 = containerRef.current?.querySelector(
      ".confession-card-2"
    ) as HTMLDivElement | null;

    if (topCard) {
      topCard.style.transition = "transform 0.25s ease-out, opacity 0.2s ease-out";
      const targetX = direction === "right" ? 520 : -520;
      topCard.style.transform = `translate3d(${targetX}px, ${
        currentY.current - startY.current
      }px, 0) rotate(${direction === "right" ? 35 : -35}deg)`;
      topCard.style.opacity = "0";

      const likeOverlay = topCard.querySelector("#swipe-like-overlay") as HTMLDivElement | null;
      const skipOverlay = topCard.querySelector("#swipe-skip-overlay") as HTMLDivElement | null;
      if (likeOverlay && direction === "right") likeOverlay.style.opacity = "1";
      if (skipOverlay && direction === "left") skipOverlay.style.opacity = "1";
    }

    // Shift lower cards up smoothly
    if (card2) {
      card2.style.transition = "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s";
      card2.style.transform = "scale(1) translate3d(0, 0px, 0)";
      card2.style.filter = "none";
    }
    if (card3) {
      card3.style.transition = "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s";
      card3.style.transform = "scale(0.96) translate3d(0, 12px, 0)";
      card3.style.filter = "blur(1px)";
    }

    setTimeout(() => {
      // Pop card from deck and recycle at the end of the deck to loop
      const swipedCard = deck[0];
      setDeck((prev) => {
        if (prev.length === 0) return prev;
        const top = prev[0];
        const remaining = prev.slice(1);
        return [...remaining, top];
      });

      // Reset DOM styling on the popped item since React will reuse card positions
      if (topCard) {
        topCard.style.transform = "";
        topCard.style.opacity = "";
        topCard.style.transition = "";
        const likeOverlay = topCard.querySelector("#swipe-like-overlay") as HTMLDivElement | null;
        const skipOverlay = topCard.querySelector("#swipe-skip-overlay") as HTMLDivElement | null;
        if (likeOverlay) likeOverlay.style.opacity = "0";
        if (skipOverlay) skipOverlay.style.opacity = "0";
      }
      if (card2) {
        card2.style.transform = "";
        card2.style.filter = "";
        card2.style.transition = "";
      }
      if (card3) {
        card3.style.transform = "";
        card3.style.filter = "";
        card3.style.transition = "";
      }

      isTransitioning.current = false;

      // Handle async db work in background
      if (swipedCard) {
        markConfessionSeen(swipedCard.id);
        if (direction === "right") {
          reactToConfession(swipedCard.id, "❤️");
        }
      }
    }, 220);
  };

  // DM Reply Handler
  const handleReplyToConfession = async (c: Confession) => {
    if (isReplying) return;
    setIsReplying(c.id);
    try {
      // Call replyToConfession server action with details
      const snippet = c.content.length > 65 ? c.content.substring(0, 65) + "..." : c.content;
      // We'll call the custom server action to resolve or create the DM room
      // We pass the profile ID of the confession poster
      const res = await replyToConfession(c.profile_id);
      
      if (res.success && res.data) {
        const roomId = res.data;

        // Post a message in the room context if room was newly created
        // We will push a system message in this room automatically
        const supabaseClient = createClient();
        // Check if there are messages in the room first (new vs existing room)
        const { count } = await supabaseClient
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId);

        if (count === 0) {
          await supabaseClient.from("messages").insert({
            room_id: roomId,
            sender_id: currentUserId,
            content: `💬 Replied to confession: "${snippet}"`,
            type: "system",
          });
        }

        // Navigate to the newly opened chat room
        router.push(`/chats/${roomId}`);
      } else {
        alert(res.message || "Failed to start private chat.");
      }
    } catch (e) {
      console.error(e);
      alert("Chat unavailable right now.");
    } finally {
      setIsReplying(null);
    }
  };

  // Toggle reactions by clicking on reaction buttons
  const handleCardReact = async (confessionId: string, emoji: string) => {
    // Optimistic reaction updates in state
    setDeck((prevDeck) =>
      prevDeck.map((c) => {
        if (c.id !== confessionId) return c;
        const exists = c.reactions.find((r) => r.emoji === emoji);
        let updatedReactions = [...c.reactions];

        if (exists) {
          if (exists.reactedByMe) {
            // Remove
            updatedReactions = updatedReactions
              .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r))
              .filter((r) => r.count > 0);
          } else {
            // Add
            updatedReactions = updatedReactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
            );
          }
        } else {
          updatedReactions.push({ emoji, count: 1, reactedByMe: true });
        }

        return {
          ...c,
          reactions: updatedReactions,
          total_reactions: updatedReactions.reduce((acc, curr) => acc + curr.count, 0),
        };
      })
    );

    // Call server action
    await reactToConfession(confessionId, emoji);
  };

  const handleMyConfessionDelete = async (confessionId: string) => {
    if (!confirm("Are you sure you want to delete this confession?")) return;

    // Optimistic deletion
    setMyConfessions((prev) => prev.filter((c) => c.id !== confessionId));
    // If it's in the deck as well (highly unlikely since we exclude own posts)
    setDeck((prev) => prev.filter((c) => c.id !== confessionId));

    await deleteConfession(confessionId);
  };

  // Confession post callback
  const handlePostCreated = (newConfession: any) => {
    // If we're on deck, we add it to the user's confessions list, or we prepend it to local myConfessions if we've fetched it
    setMyConfessions((prev) => [newConfession, ...prev]);

    // Show a premium floating toast message
    const toast = document.createElement("div");
    toast.className =
      "fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#00F0A0] text-black px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg animate-fade-in-out flex items-center gap-2";
    toast.innerHTML = `<span>🤫</span> Whisper posted successfully!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  };

  return (
    <main className="flex-1 flex flex-col bg-[#08080C] min-h-screen pb-24 overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[60%] rounded-full bg-[#00F0A0]/3 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] rounded-full bg-purple-500/3 blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#08080C]/85 backdrop-blur-md border-b border-zinc-900/60 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-extrabold font-heading text-white tracking-tight">
            Discover
          </h1>
          <p className="text-[10px] font-bold text-zinc-500 tracking-wide uppercase mt-0.5">
            Campus Pulse Feed
          </p>
        </div>

        {/* Tab Toggle (Tinder style / List style for My Confessions) */}
        <div className="flex items-center gap-1.5 bg-zinc-950/60 border border-zinc-900/80 p-1.5 rounded-full">
          <button
            onClick={() => setActiveTab("deck")}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              activeTab === "deck" ? "bg-white/10 text-white font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab("my-whispers")}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              activeTab === "my-whispers" ? "bg-white/10 text-white font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            My Whispers
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Refresh feed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>

          {/* Compose trigger */}
          <button
            onClick={() => setIsPostSheetOpen(true)}
            className="w-9 h-9 rounded-xl bg-[#00F0A0] text-black font-bold flex items-center justify-center shadow-[0_0_12px_rgba(0,240,160,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Discover Layout */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 relative py-4 min-h-0">
        {activeTab === "deck" ? (
          /* CARD DECK CONTAINER */
          deck.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-900 flex items-center justify-center text-3xl shadow-inner shadow-black/40">
                ✨
              </div>
              <div className="space-y-1">
                <h3 className="text-white font-bold text-base">You've swiped everything!</h3>
                <p className="text-zinc-500 text-xs max-w-[240px] leading-relaxed mx-auto">
                  You've read every confession on campus. Whisper something new to get things started!
                </p>
              </div>
              <button
                onClick={() => setIsPostSheetOpen(true)}
                className="px-6 py-3 rounded-full bg-[#00F0A0] text-black font-black text-xs tracking-widest uppercase hover:opacity-95 active:scale-95 transition-all shadow-[0_4px_16px_rgba(0,240,160,0.2)] cursor-pointer"
              >
                Share a Whisper
              </button>
            </div>
          ) : (
            <div className="w-full max-w-[340px] flex flex-col items-center justify-center flex-1 min-h-0 py-6">
              {/* Stack */}
              <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full aspect-[3/4] max-h-[460px] relative select-none touch-none"
              >
                {deck.slice(0, 3).map((confession, index) => {
                  // Determine absolute stacking classes
                  let cardStyle: React.CSSProperties = {};
                  if (index === 1) {
                    cardStyle = {
                      transform: "scale(0.96) translate3d(0, 12px, 0)",
                      filter: "blur(1px)",
                      opacity: 0.9,
                    };
                  } else if (index === 2) {
                    cardStyle = {
                      transform: "scale(0.92) translate3d(0, 24px, 0)",
                      filter: "blur(2px)",
                      opacity: 0.8,
                    };
                  }

                  return (
                    <ConfessionCard
                      key={confession.id}
                      confession={confession}
                      isTop={index === 0}
                      style={cardStyle}
                      onReactClick={(emoji) => handleCardReact(confession.id, emoji)}
                      onReplyClick={() => handleReplyToConfession(confession)}
                    />
                  );
                })}

                {/* Popped overlay class targets */}
                <div className="confession-card-0 hidden" />
                <div className="confession-card-1 hidden" />
                <div className="confession-card-2 hidden" />
              </div>

              {/* Deck Action buttons */}
              <div className="flex items-center gap-6 mt-8 select-none">
                {/* Skip button */}
                <button
                  onClick={() => triggerSwipeAnimation("left")}
                  disabled={isTransitioning.current}
                  className="w-14 h-14 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-zinc-900 active:scale-90 transition-all cursor-pointer shadow-lg shadow-black/40 disabled:opacity-50"
                  title="Skip"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {/* Reply button */}
                <button
                  onClick={() => handleReplyToConfession(deck[0])}
                  disabled={isTransitioning.current || !deck[0]?.allow_dm || isReplying !== null}
                  className={`w-12 h-12 rounded-full border border-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 active:scale-90 transition-all cursor-pointer shadow-lg shadow-black/40 disabled:opacity-30 disabled:pointer-events-none`}
                  title="Reply anonymously via DM"
                >
                  {isReplying === deck[0]?.id ? (
                    <svg
                      className="animate-spin h-5 w-5 text-white"
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
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                </button>

                {/* React button */}
                <button
                  onClick={() => triggerSwipeAnimation("right")}
                  disabled={isTransitioning.current}
                  className="w-14 h-14 rounded-full bg-[#00F0A0] text-black flex items-center justify-center hover:opacity-90 active:scale-90 transition-all cursor-pointer shadow-lg shadow-[#00F0A0]/10 disabled:opacity-50"
                  title="React ❤️"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              </div>
            </div>
          )
        ) : (
          /* MY CONFESSIONS VIEW */
          <div className="w-full max-w-[480px] flex-1 flex flex-col min-h-0 select-text overflow-hidden">
            {loadingMyConfessions ? (
              <div className="flex-1 flex items-center justify-center">
                <svg
                  className="animate-spin h-8 w-8 text-[#00F0A0]"
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
              </div>
            ) : myConfessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <p className="text-zinc-500 text-sm">You haven't whispered any confessions yet.</p>
                <button
                  onClick={() => setIsPostSheetOpen(true)}
                  className="px-5 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Post Your First Whisper
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-4">
                {myConfessions.map((c) => {
                  const gradientClass =
                    CONFESSION_GRADIENTS[c.gradient_id] || CONFESSION_GRADIENTS[0];
                  return (
                    <div
                      key={c.id}
                      className={`w-full rounded-2xl bg-gradient-to-br ${gradientClass} border border-white/5 p-5 shadow-lg relative flex flex-col space-y-4 overflow-hidden`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                          {c.mood_emoji}
                        </div>
                        <button
                          onClick={() => handleMyConfessionDelete(c.id)}
                          className="w-7 h-7 rounded-lg bg-red-950/40 hover:bg-red-950/60 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors border border-red-900/40 active:scale-95 cursor-pointer"
                          title="Delete Whisper"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>

                      {/* Content */}
                      <p className="text-white font-bold leading-relaxed text-sm break-words select-text">
                        &ldquo;{c.content}&rdquo;
                      </p>

                      {/* Stats */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider select-none">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span>Active</span>
                        </div>

                        {/* Reactions summary strip */}
                        <div className="flex items-center gap-1.5 select-none">
                          {c.reactions.length === 0 ? (
                            <span className="text-[10px] text-zinc-500 font-bold">
                              No reactions yet
                            </span>
                          ) : (
                            c.reactions.map((r) => (
                              <span
                                key={r.emoji}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-white"
                              >
                                <span>{r.emoji}</span>
                                <span>{r.count}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post sheet */}
      <PostWhisperSheet
        isOpen={isPostSheetOpen}
        onClose={() => setIsPostSheetOpen(false)}
        onPostCreated={handlePostCreated}
        currentNickname={currentNickname}
        currentAvatar={currentAvatar}
        currentUserId={currentUserId}
      />

      {/* Bottom Navigation */}
      <BottomNav activeTab="discover" />
    </main>
  );
}

// Helper gradients copy for self-contained usage
const CONFESSION_GRADIENTS = [
  "from-[#1E1E38] to-[#0F0F1E] border-violet-950/40",
  "from-[#1A1C3A] to-[#3B154C] border-purple-950/40",
  "from-[#0E2A1E] to-[#1E4D2B] border-emerald-950/40",
  "from-[#4A0E4E] to-[#6C3E70] border-pink-950/40",
  "from-[#521C00] to-[#8C3A00] border-orange-950/40",
  "from-[#042037] to-[#0A4D68] border-sky-950/40",
  "from-[#1C1D21] to-[#3A3F47] border-zinc-800/40",
  "from-[#380E0E] to-[#5C1A1A] border-red-950/40",
];
