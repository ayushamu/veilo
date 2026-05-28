"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePwa } from "@/hooks/use-pwa";

interface WhisperItem {
  id: string;
  content: string;
  tag: string;
  time: string;
  likes: number;
  comments: number;
  hasLiked?: boolean;
}

export default function HomePage() {
  const [whispers, setWhispers] = useState<WhisperItem[]>([
    {
      id: "w1",
      content: '"The arts faculty bench has the best sunset view... and somehow the Wi-Fi reaches there."',
      tag: "#EngineeringGate",
      time: "5m ago",
      likes: 12,
      comments: 4,
    },
    {
      id: "w2",
      content: '"Is it just me or was the mid-term for PSYCH101 unnecessarily brutal today?"',
      tag: "#AcademicCrisis",
      time: "2m ago",
      likes: 8,
      comments: 1,
    },
    {
      id: "w3",
      content: '"To the girl in the red scarf at the library: Your focus is intimidatingly impressive."',
      tag: "#LibraryCrush",
      time: "12m ago",
      likes: 142,
      comments: 18,
    },
    {
      id: "w4",
      content: '"Free pizza at the main hall. Don\'t ask, just run."',
      tag: "#URGENT",
      time: "1m ago",
      likes: 54,
      comments: 12,
    },
    {
      id: "w5",
      content: '"Can someone return the calculator borrowed at Kennedy Hall last Tuesday? I have exams coming."',
      tag: "#HelpCampus",
      time: "32m ago",
      likes: 19,
      comments: 7,
    },
  ]);

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("whispers");
  const [lockedAlert, setLockedAlert] = useState<boolean>(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState<boolean>(false);

  const { deferredPrompt, triggerInstall } = usePwa();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const handlePwaInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (deferredPrompt) {
      const success = await triggerInstall();
      if (!success) {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  // Mock Phone Chat States
  const [phoneMessages, setPhoneMessages] = useState([
    { id: "m1", sender: "falcon", avatar: "🦅", content: "Anyone down for coffee?", isMe: false },
    { id: "m2", sender: "me", avatar: "💬", content: "I'm at the student center!", isMe: true },
    { id: "m3", sender: "falcon", avatar: "🦅", content: "Great, see you in 5.", isMe: false }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Automatically scroll phone chat to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [phoneMessages, isKeyboardVisible]);

  // Handle mock message send
  const handleSendPhoneMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    const myMsgId = "me_" + Date.now();
    const myMsgText = inputValue;
    
    setPhoneMessages(prev => [
      ...prev,
      { id: myMsgId, sender: "me", avatar: "💬", content: myMsgText, isMe: true }
    ]);
    setInputValue("");

    // Simulate auto-reply
    setTimeout(() => {
      const replies = [
        "Cafeteria is packed, let's meet near Bab-e-Syed! 🏰",
        "Haha agreed, class was so boring today anyway.",
        "Sure, count me in! ☕",
        "Who is this? Whispers travels fast here haha 👀",
        "Awesome! I'll be there in 10 mins."
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      setPhoneMessages(prev => [
        ...prev,
        { id: "reply_" + Date.now(), sender: "falcon", avatar: "🦅", content: randomReply, isMe: false }
      ]);
    }, 1500);
  };

  // Virtual keyboard typing handler
  const handleVirtualKeyPress = (key: string) => {
    if (key === "⌫") {
      setInputValue(prev => prev.slice(0, -1));
    } else if (key === "space") {
      setInputValue(prev => prev + " ");
    } else if (key === "Return") {
      if (inputValue.trim()) {
        handleSendPhoneMessage();
      }
      setIsKeyboardVisible(false);
    } else if (key === "123") {
      // Ignore/do nothing
    } else {
      setInputValue(prev => prev + key);
    }
  };

  // Custom magnetic cursor loop
  useEffect(() => {
    // Check if device supports touch
    const isTouch = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    if (isTouch) return;

    setShowCursor(true);

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", handleMouseMove);

    let frameId: number;
    const updateCursor = () => {
      const dx = mousePos.current.x - currentPos.current.x;
      const dy = mousePos.current.y - currentPos.current.y;
      
      // Smooth interpolation (damping)
      currentPos.current.x += dx * 0.15;
      currentPos.current.y += dy * 0.15;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${currentPos.current.x - 10}px, ${currentPos.current.y - 10}px, 0)`;
      }
      frameId = requestAnimationFrame(updateCursor);
    };

    frameId = requestAnimationFrame(updateCursor);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, []);

  // Scroll Reveal Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -50px 0px" }
    );

    const elements = document.querySelectorAll(".reveal, .reveal-left, .reveal-right");
    elements.forEach((el) => observer.observe(el));

    // Cleanup
    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);

  // Magnetic Hover Event Handlers
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate3d(${x * 0.2}px, ${y * 0.2}px, 0) scale3d(1.04, 1.04, 1.04)`;
    
    if (cursorRef.current) {
      cursorRef.current.style.width = "40px";
      cursorRef.current.style.height = "40px";
      cursorRef.current.style.opacity = "0.3";
      cursorRef.current.style.background = "#00F0A0";
    }
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    el.style.transform = `translate3d(0px, 0px, 0) scale3d(1, 1, 1)`;

    if (cursorRef.current) {
      cursorRef.current.style.width = "20px";
      cursorRef.current.style.height = "20px";
      cursorRef.current.style.opacity = "0.6";
      cursorRef.current.style.background = "#00F0A0";
    }
  };

  // Like action handler
  const handleLike = (id: string) => {
    setWhispers(prev =>
      prev.map(item => {
        if (item.id === id) {
          const isLiked = !item.hasLiked;
          return {
            ...item,
            likes: isLiked ? item.likes + 1 : item.likes - 1,
            hasLiked: isLiked,
          };
        }
        return item;
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden selection:bg-[#00F0A0]/30 selection:text-[#00F0A0] relative">
      {/* Custom Floating Easing Cursor */}
      {showCursor && (
        <div
          ref={cursorRef}
          className="pointer-events-none fixed top-0 left-0 w-5 h-5 bg-[#00F0A0] rounded-full filter blur-[4px] opacity-60 z-[9999] transition-[width,height,opacity,background] duration-200"
        />
      )}

      {/* Grain Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.03] z-50 bg-repeat"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3联%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")"
        }}
      />

      {/* Sticky Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-[#080808]/40 backdrop-blur-xl border-b border-glass-border">
        <div className="flex justify-between items-center px-6 lg:px-24 py-5 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-3">
            <img 
              alt="Veilo Logo" 
              className="w-9 h-9 object-contain" 
              src="/icon-192.png" 
            />
            <span className="font-hanken text-2xl font-black text-[#00F0A0] tracking-tighter">Veilo</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a 
              className={`font-hanken text-sm font-semibold transition-colors duration-300 ${activeTab === "whispers" ? "text-[#00F0A0] border-b-2 border-[#00F0A0] pb-1" : "text-zinc-400 hover:text-white"}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab("whispers"); }}
            >
              Whispers
            </a>
            <a 
              className={`font-hanken text-sm font-semibold transition-colors duration-300 ${activeTab === "identities" ? "text-[#00F0A0] border-b-2 border-[#00F0A0] pb-1" : "text-zinc-400 hover:text-white"}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab("identities"); }}
            >
              Identities
            </a>
            <button 
              className="text-zinc-400 hover:text-white font-hanken text-sm font-semibold transition-colors duration-300 cursor-pointer bg-transparent border-none p-0" 
              onClick={handlePwaInstallClick}
            >
              Web App
            </button>
            <Link 
              className="text-zinc-400 hover:text-white font-hanken text-sm font-semibold transition-colors duration-300" 
              href="/login"
            >
              Network
            </Link>
          </div>
          <Link
            href="/login"
            onMouseMove={handleMagneticMove}
            onMouseLeave={handleMagneticLeave}
            className="bg-[#00F0A0] text-black px-6 py-2.5 rounded-full font-hanken font-bold text-sm hover:shadow-[0_0_20px_rgba(0,240,160,0.4)] active:scale-95 transition-all duration-300 inline-block"
          >
            Enter Veilo
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 px-6">
        <div className="absolute inset-0 pointer-events-none">
          {/* Animated decorative glows */}
          <div className="absolute top-[20%] left-[15%] w-48 h-48 bg-[#00F0A0]/10 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[20%] right-[15%] w-72 h-72 bg-[#00D2FF]/5 rounded-full blur-[120px]"></div>
          
          {/* Floating cards */}
          <div className="absolute top-[25%] right-[12%] animate-float opacity-30 hidden lg:block">
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-[#00F0A0] text-3xl">water_drop</span>
              <div className="h-2 w-16 bg-white/20 rounded-full"></div>
            </div>
          </div>
          <div className="absolute bottom-[28%] left-[10%] animate-float opacity-20 hidden lg:block" style={{ animationDelay: "2.5s" }}>
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-[#00F0A0] text-3xl">raven</span>
              <div className="h-2 w-24 bg-white/20 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="font-hanken text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-tight mb-8">
            A Hidden <span className="text-[#00F0A0] italic font-serif">Social World</span> <br />for AMU.
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-zinc-400 font-sans max-w-2xl mx-auto mb-12 leading-relaxed">
            Anonymous. Realtime. University Exclusive. Some conversations are easier when nobody knows your name.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full max-w-md">
            <Link
              href="/login"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="w-full sm:w-auto px-10 py-5 bg-[#00F0A0] text-black font-hanken font-extrabold rounded-full text-base tracking-wide text-center hover:shadow-[0_0_30px_rgba(0,240,160,0.35)] transition-all duration-300"
            >
              Enter Veilo
            </Link>
            <Link
              href="/login"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="w-full sm:w-auto px-10 py-5 border border-glass-border text-white font-hanken font-bold rounded-full text-base text-center hover:bg-white/5 transition-all duration-300"
            >
              Explore Campus
            </Link>
          </div>
        </div>
      </section>

      {/* Identities Section */}
      <section id="identities" className="py-24 lg:py-32 px-6 lg:px-24 max-w-[1440px] mx-auto relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 lg:mb-20 gap-8">
          <div className="reveal">
            <h2 className="font-hanken text-3xl md:text-5xl font-extrabold tracking-tight mb-4">Your Secret Identity, Locked.</h2>
            <p className="text-zinc-400 text-sm md:text-base lg:text-lg font-sans max-w-lg leading-relaxed">
              Every session, a new persona. Be anyone, say anything, leave no trace.
            </p>
          </div>
          <div className="reveal delay-100">
            <span className="material-symbols-outlined text-[#00F0A0] text-6xl lg:text-7xl opacity-40 animate-pulse">fingerprint</span>
          </div>
        </div>

        {lockedAlert && (
          <div className="mb-6 p-4 bg-[#FF4B72]/10 border border-[#FF4B72]/30 text-[#FF4B72] rounded-2xl flex items-center justify-between animate-fade-in font-sans text-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">info</span>
              <span>Please verify your @myamu.ac.in or @amu.ac.in email address to unlock your campus identity.</span>
            </div>
            <button onClick={() => setLockedAlert(false)} className="hover:opacity-80"><span className="material-symbols-outlined">close</span></button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 reveal delay-200">
          {/* Identity Card 1 */}
          <div 
            onMouseEnter={() => setHoveredCard("falcon")}
            onMouseLeave={() => setHoveredCard(null)}
            className={`glass-card p-8 lg:p-10 rounded-3xl group cursor-pointer transition-all duration-500 relative overflow-hidden ${hoveredCard === "falcon" ? "scale-[1.02] border-[#00F0A0]/30 shadow-[0_15px_40px_rgba(0,240,160,0.08)]" : ""}`}
          >
            <div className="w-16 h-16 bg-[#00F0A0]/15 rounded-full flex items-center justify-center mb-8 group-hover:bg-[#00F0A0]/25 transition-colors duration-300">
              <span className="material-symbols-outlined text-[#00F0A0] text-3xl">raven</span>
            </div>
            <h3 className="font-hanken text-xl lg:text-2xl font-bold mb-2">Emerald Falcon</h3>
            <p className="text-zinc-500 text-sm mb-6">Status: Masked & Active</p>
            <div className="h-1 w-full bg-glass-border rounded-full overflow-hidden">
              <div className="h-full bg-[#00F0A0] w-2/3 transition-all duration-1000 group-hover:w-full"></div>
            </div>
          </div>

          {/* Identity Card 2 */}
          <div 
            onMouseEnter={() => setHoveredCard("raven")}
            onMouseLeave={() => setHoveredCard(null)}
            className={`glass-card p-8 lg:p-10 rounded-3xl group cursor-pointer transition-all duration-500 relative overflow-hidden ${hoveredCard === "raven" ? "scale-[1.02] border-[#00F0A0]/30 shadow-[0_15px_40px_rgba(0,240,160,0.08)]" : ""}`}
          >
            <div className="w-16 h-16 bg-[#00F0A0]/15 rounded-full flex items-center justify-center mb-8 group-hover:bg-[#00F0A0]/25 transition-colors duration-300">
              <span className="material-symbols-outlined text-[#00F0A0] text-3xl">visibility_off</span>
            </div>
            <h3 className="font-hanken text-xl lg:text-2xl font-bold mb-2">Shadow Raven</h3>
            <p className="text-zinc-500 text-sm mb-6">Status: Whispering...</p>
            <div className="flex gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00F0A0] animate-bounce"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#00F0A0] animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#00F0A0] animate-bounce" style={{ animationDelay: "0.4s" }}></div>
            </div>
          </div>

          {/* Identity Card 3 */}
          <div 
            onClick={() => setLockedAlert(true)}
            onMouseEnter={() => setHoveredCard("locked")}
            onMouseLeave={() => setHoveredCard(null)}
            className={`glass-card p-8 lg:p-10 rounded-3xl group cursor-pointer transition-all duration-500 relative overflow-hidden ${hoveredCard === "locked" ? "scale-[1.02] border-zinc-700 shadow-xl" : ""}`}
          >
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors duration-300">
              <span className="material-symbols-outlined text-zinc-500 text-3xl">lock</span>
            </div>
            <h3 className="font-hanken text-xl lg:text-2xl font-bold mb-2 text-zinc-300">Locked Ghost</h3>
            <p className="text-zinc-500 text-xs md:text-sm mb-6">Connect to university email to unlock.</p>
            <button className="text-[#00F0A0] font-hanken font-bold text-sm flex items-center gap-1.5 hover:underline group-hover:translate-x-1 transition-transform duration-300">
              Unlock <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>

      {/* Whispers Feed Section */}
      <section id="whispers" className="py-24 bg-[#0c0c0f]/50 border-y border-glass-border relative">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-24">
          <div className="reveal">
            <h2 className="font-hanken text-3xl md:text-5xl font-extrabold tracking-tight mb-4">Campus Pulse</h2>
            <p className="text-zinc-400 text-sm md:text-base lg:text-lg font-sans">
              Realtime whispers from every corner of the university campus.
            </p>
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 lg:gap-8 space-y-6 lg:space-y-8 reveal delay-200">
            {whispers.map((item) => (
              <div key={item.id} className="break-inside-avoid">
                <div className="glass-card p-6 lg:p-8 rounded-2xl relative overflow-hidden group hover:border-[#00F0A0]/20 transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-20 text-zinc-500 text-xs">
                    <span className="material-symbols-outlined text-base">schedule</span>
                  </div>
                  <p className="font-sans text-sm md:text-base leading-relaxed text-zinc-200 mb-6 mt-1">
                    {item.content}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-[#00F0A0] font-hanken text-xs font-black tracking-widest uppercase">
                      {item.tag}
                    </span>
                    <div className="flex items-center gap-4 text-zinc-500 text-xs">
                      <button 
                        onClick={() => handleLike(item.id)}
                        className={`flex items-center gap-1 transition-colors duration-300 ${item.hasLiked ? "text-[#FF4B72]" : "hover:text-[#00F0A0]"}`}
                      >
                        <span className={`material-symbols-outlined text-lg ${item.hasLiked ? "fill-current" : ""}`}>favorite</span> 
                        {item.likes}
                      </button>
                      <button className="flex items-center gap-1 hover:text-[#00F0A0] transition-colors duration-300">
                        <span className="material-symbols-outlined text-lg">chat_bubble</span> 
                        {item.comments}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Realtime Interaction Phone Mockup */}
      <section className="py-24 lg:py-32 px-6 lg:px-24 overflow-hidden max-w-[1440px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div className="lg:w-1/2 reveal-left">
            <h2 className="font-hanken text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
              Snapchat-like <span className="text-[#00F0A0] italic font-serif">Fluidity</span>.
            </h2>
            <p className="text-zinc-400 text-base md:text-lg font-sans mb-8 leading-relaxed">
              Messages that breathe. Experience a UI that reacts to your presence with subtle parallax, micro-interactions, and organic campus chat motions.
            </p>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <span className="material-symbols-outlined text-[#00F0A0] text-3xl mt-0.5">bolt</span>
                <div>
                  <h4 className="font-hanken font-bold text-lg text-white mb-1">Zero Latency</h4>
                  <p className="text-zinc-500 text-sm font-sans leading-relaxed">
                    Powered by high-performance university-grade realtime synchronization channels.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="material-symbols-outlined text-[#00F0A0] text-3xl mt-0.5">auto_delete</span>
                <div>
                  <h4 className="font-hanken font-bold text-lg text-white mb-1">Self-Destructing Media</h4>
                  <p className="text-zinc-500 text-sm font-sans leading-relaxed">
                    Share secure photos, visual snippets, and media assets that vanish after being viewed.
                  </p>
                </div>
              </li>
            </ul>
          </div>
          
          <div className="lg:w-1/2 relative reveal-right delay-200">
            {/* Phone Container */}
            <div className="relative mx-auto border-[10px] border-zinc-800 rounded-[3rem] w-[310px] sm:w-[320px] h-[620px] sm:h-[640px] bg-black shadow-2xl overflow-hidden">
              {/* Phone Speaker Notch */}
              <div className="absolute top-0 w-full h-8 bg-black flex justify-center items-end pb-1.5 z-20">
                <div className="w-20 h-4 bg-zinc-900 rounded-full"></div>
              </div>
              
              {/* Mock Chat UI */}
              <div className="pt-12 flex flex-col h-full bg-[#08080c] relative select-none">
                {/* Header */}
                <div 
                  onClick={() => setIsKeyboardVisible(false)} 
                  className="flex items-center gap-3 border-b border-glass-border pb-3 mb-2 mt-1 px-5 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#00F0A0]/15 flex items-center justify-center text-xs text-[#00F0A0]">👑</div>
                  <div>
                    <h5 className="text-xs font-bold text-white">#GeneralCampus</h5>
                    <p className="text-[10px] text-zinc-500">186 online</p>
                  </div>
                </div>

                {/* Messages */}
                <div 
                  onClick={() => setIsKeyboardVisible(false)} 
                  ref={chatContainerRef} 
                  className="flex-1 space-y-4 overflow-y-auto pr-1 px-5 scroll-smooth"
                >
                  {phoneMessages.map((msg, index) => {
                    const delay = `${(index * 0.6) % 2}s`;
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex gap-2.5 items-end animate-float ${msg.isMe ? "flex-row-reverse" : ""}`}
                        style={{ animationDelay: delay }}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] ${msg.isMe ? "bg-[#00D2FF]/10 text-[#00D2FF]" : "bg-[#00F0A0]/10 text-[#00F0A0]"}`}>
                          {msg.avatar}
                        </div>
                        <div 
                          className={`p-3 rounded-2xl text-[13px] leading-relaxed max-w-[80%] ${
                            msg.isMe 
                              ? "bg-[#00F0A0] text-black rounded-tr-none font-medium" 
                              : "glass-card text-zinc-200 border-zinc-800 rounded-tl-none"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input Bar */}
                <div className="pb-3 border-t border-glass-border pt-3 px-5">
                  <form 
                    onSubmit={handleSendPhoneMessage}
                    className="bg-white/5 rounded-full p-1.5 pl-3.5 flex items-center justify-between border border-white/10"
                  >
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onFocus={() => setIsKeyboardVisible(true)}
                      className="bg-transparent text-white text-xs outline-none flex-1 pr-2 placeholder:text-zinc-600"
                      placeholder="Type a whisper..."
                    />
                    <button 
                      type="submit" 
                      className="w-7 h-7 rounded-full bg-[#00F0A0] flex items-center justify-center text-black cursor-pointer hover:bg-white transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm font-black">send</span>
                    </button>
                  </form>
                </div>

                {/* Virtual Keyboard */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isKeyboardVisible 
                      ? "max-h-[200px] opacity-100 border-t border-zinc-800/80 p-2 bg-[#12121a]/95 backdrop-blur-md" 
                      : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  <div className="grid gap-1">
                    {/* Row 1 */}
                    <div className="flex gap-0.5 justify-center">
                      {["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"].map(key => (
                        <button 
                          key={key} 
                          type="button" 
                          onClick={() => handleVirtualKeyPress(key)} 
                          className="flex-1 h-7 bg-[#2c2c2e] hover:bg-[#3a3a3c] active:bg-[#48484a] rounded text-white text-[11px] font-semibold shadow-sm select-none"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                    {/* Row 2 */}
                    <div className="flex gap-0.5 justify-center px-1.5">
                      {["a", "s", "d", "f", "g", "h", "j", "k", "l"].map(key => (
                        <button 
                          key={key} 
                          type="button" 
                          onClick={() => handleVirtualKeyPress(key)} 
                          className="flex-1 h-7 bg-[#2c2c2e] hover:bg-[#3a3a3c] active:bg-[#48484a] rounded text-white text-[11px] font-semibold shadow-sm select-none"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                    {/* Row 3 */}
                    <div className="flex gap-0.5 justify-center">
                      <div className="w-[8%] h-7 flex items-center justify-center opacity-30">
                        <span className="material-symbols-outlined text-[10px]">arrow_upward</span>
                      </div>
                      {["z", "x", "c", "v", "b", "n", "m"].map(key => (
                        <button 
                          key={key} 
                          type="button" 
                          onClick={() => handleVirtualKeyPress(key)} 
                          className="flex-1 h-7 bg-[#2c2c2e] hover:bg-[#3a3a3c] active:bg-[#48484a] rounded text-white text-[11px] font-semibold shadow-sm select-none"
                        >
                          {key}
                        </button>
                      ))}
                      <button 
                        type="button" 
                        onClick={() => handleVirtualKeyPress("⌫")} 
                        className="w-[12%] h-7 bg-[#3a3a3c] hover:bg-[#48484a] rounded text-white text-[10px] font-semibold shadow-sm flex items-center justify-center select-none"
                      >
                        ⌫
                      </button>
                    </div>
                    {/* Row 4 */}
                    <div className="flex gap-1 justify-between mt-0.5">
                      <button 
                        type="button" 
                        onClick={() => handleVirtualKeyPress("123")} 
                        className="w-[15%] h-7 bg-[#3a3a3c] hover:bg-[#48484a] rounded text-white text-[9px] font-semibold shadow-sm select-none"
                      >
                        123
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleVirtualKeyPress("space")} 
                        className="flex-1 h-7 bg-[#2c2c2e] hover:bg-[#3a3a3c] rounded text-white text-[10px] font-semibold shadow-sm select-none"
                      >
                        space
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleVirtualKeyPress("Return")} 
                        className="w-[25%] h-7 bg-[#00F0A0] hover:bg-[#00F0A0]/90 active:bg-white text-black rounded text-[10px] font-bold shadow-sm select-none"
                      >
                        Return
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Background Blur Flare */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-[#00F0A0]/10 rounded-full blur-[100px] pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 relative overflow-hidden bg-black flex items-center justify-center text-center">
        <div className="absolute inset-0 bg-gradient-to-t from-[#00F0A0]/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 reveal">
          <h2 className="font-hanken text-4xl md:text-6xl font-black tracking-tight leading-tight mb-8">
            Freedom without <br className="hidden sm:inline" /> social pressure.
          </h2>
          <p className="text-zinc-400 text-base md:text-lg font-sans max-w-2xl mx-auto mb-12 leading-relaxed">
            Join thousands of verified students who have found their voice on Veilo. The university&apos;s only encrypted, anonymous social network.
          </p>
          <div className="flex flex-col items-center gap-5">
            <Link
              href="/login"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="px-12 py-5 bg-[#00F0A0] text-black font-hanken font-extrabold rounded-full text-lg tracking-wide hover:shadow-[0_0_30px_rgba(0,240,160,0.4)] active:scale-95 transition-all duration-300 inline-block"
            >
              Join the Shadow Network
            </Link>
            <p className="text-zinc-500 text-[10px] tracking-widest font-bold uppercase font-hanken">
              UNIVERSITY ACCESS ONLY • VERIFIED EMAIL REQUIRED
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-glass-border bg-[#080808]">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-24 py-12 max-w-[1440px] mx-auto gap-8 text-center md:text-left">
          <div className="flex flex-col gap-3 items-center md:items-start">
            <div className="flex items-center gap-2.5">
              <img 
                alt="Veilo Logo Small" 
                className="w-5 h-5 grayscale opacity-50" 
                src="/icon-192.png" 
              />
              <span className="font-hanken text-[11px] font-black tracking-widest text-zinc-500 uppercase">
                VEILO / AMU
              </span>
            </div>
            <p className="text-zinc-600 text-xs font-sans">
              © 2026 Veilo. Anonymous. Secure. University Only.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 lg:gap-8 text-zinc-500 text-xs font-medium font-sans">
            <Link className="hover:text-[#00F0A0] transition-colors" href="/privacy">Privacy Policy</Link>
            <Link className="hover:text-[#00F0A0] transition-colors" href="/terms">Terms of Service</Link>
            <a className="hover:text-[#00F0A0] transition-colors" href="https://instagram.com/veilo.chat" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a className="hover:text-[#00F0A0] transition-colors" href="#">Security Lab</a>
            <a className="hover:text-[#00F0A0] transition-colors" href="#">Campus Support</a>
          </div>
        </div>
      </footer>

      {/* PWA Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all duration-300 animate-fadeIn">
          {/* Backdrop click to close */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setShowInstallGuide(false)} />
          
          <div className="relative w-full max-w-sm bg-[#12121A] border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center overflow-hidden z-10 font-sans">
            {/* Top green accent line */}
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#00F0A0]" />
            
            {/* Close Button */}
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* App Icon */}
            <div className="relative w-16 h-16 mb-4 mt-2 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(0,240,160,0.15)] border border-zinc-700/50 flex items-center justify-center bg-zinc-900">
              <img
                src="/icon-192.png"
                alt="Veilo Icon"
                className="w-12 h-12 object-contain"
              />
            </div>

            <h3 className="text-xl font-bold font-hanken text-white tracking-tight mb-2">
              Install Veilo Web App
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6 px-2 font-sans">
              Install Veilo on your home screen for quick, standalone full-screen access and instant notifications.
            </p>

            {/* Device Specific Instructions */}
            <div className="w-full text-left space-y-4 mb-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 font-sans text-xs">
              {typeof window !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                <>
                  <p className="text-[#00F0A0] font-semibold uppercase tracking-wider text-[10px] mb-1 font-hanken">iOS Safari Instructions</p>
                  <ol className="space-y-2.5 text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>Tap the share icon <span className="text-[#00F0A0] font-bold">📤</span> at the bottom of Safari.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>Scroll down and select <span className="text-white font-semibold">Add to Home Screen</span>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                      <span>Tap <span className="text-[#00F0A0] font-bold">Add</span> in the top-right corner.</span>
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="text-[#00F0A0] font-semibold uppercase tracking-wider text-[10px] mb-1 font-hanken">Desktop / Android Instructions</p>
                  <ol className="space-y-2.5 text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>Click your browser menu (three dots <span className="text-white font-bold">⋮</span> or settings).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>Choose <span className="text-white font-semibold">Install App</span> or <span className="text-white font-semibold">Add to Home Screen</span>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                      <span>Accept the prompt to add it to your device.</span>
                    </li>
                  </ol>
                </>
              )}
            </div>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full bg-[#00F0A0] text-black font-bold py-3 px-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,240,160,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm font-hanken"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
