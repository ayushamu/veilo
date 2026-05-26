"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendOTP } from "@/app/actions/auth";
import { getActiveUserCount } from "@/app/actions/profile";

interface SignupEvent {
  emoji: string;
  name: string;
  domain: string;
  action: string;
}

const MOCK_SIGNUPS: SignupEvent[] = [
  { emoji: "🦊", name: "Silent Falcon", domain: "@myamu.ac.in", action: "just verified their student email!" },
  { emoji: "🦉", name: "Midnight Owl", domain: "@amu.ac.in", action: "entered the campus group chat!" },
  { emoji: "🐺", name: "Velvet Leopard", domain: "@myamu.ac.in", action: "joined the campus network!" },
  { emoji: "🦌", name: "Emerald Stag", domain: "@myamu.ac.in", action: "just verified their student email!" },
  { emoji: "🐱‍👤", name: "Cosmic Shadow", domain: "@amu.ac.in", action: "entered the campus group chat!" },
  { emoji: "🐲", name: "Zenith Dragon", domain: "@myamu.ac.in", action: "joined the campus network!" },
  { emoji: "🤖", name: "Neon Cyber", domain: "@amu.ac.in", action: "just verified their student email!" },
  { emoji: "👻", name: "Mystic Specter", domain: "@myamu.ac.in", action: "entered the campus group chat!" },
];


const TERMS_SECTIONS = [
  {
    title: "1. Eligibility",
    content: [
      "You must be a currently enrolled university student with a valid university email address.",
      "You must provide accurate information during verification.",
      "You must be at least 18 years old or meet the minimum legal age required in your jurisdiction.",
      "One person may maintain only one active account unless explicitly permitted by Veilo.",
    ],
  },
  {
    title: "2. Your Privacy & Anonymity",
    content: [
      "Your university email is used solely for account verification, security, and account recovery.",
      "Your email address is never displayed publicly to other users.",
      "Your real identity is not shown within chats unless you choose to reveal it yourself.",
      "Veilo provides anonymity to other users, not immunity from platform rules or applicable laws.",
    ],
  },
  {
    title: "3. Acceptable Use",
    content: [
      "You agree to use Veilo respectfully and responsibly.",
      "You may: participate in discussions, join group conversations, send direct messages, share appropriate images and content, and report users who violate these rules.",
    ],
  },
  {
    title: "4. Prohibited Conduct",
    content: [
      "Harassment, bullying, stalking, or intimidation.",
      "Hate speech or discrimination based on religion, race, ethnicity, nationality, gender, sexual orientation, disability, or similar characteristics.",
      "Threats of violence or encouragement of self-harm.",
      "Sharing private information about another person without permission.",
      "Impersonating another student, faculty member, organization, or individual.",
      "Spam, scams, phishing attempts, or fraudulent activity.",
      "Sharing illegal, obscene, sexually explicit, or exploitative content.",
      "Uploading malware, harmful software, or malicious links.",
      "Creating multiple accounts to evade moderation actions.",
      "Any activity that violates university policies or applicable laws.",
    ],
  },
  {
    title: "5. Image & Content Sharing",
    content: [
      "You are responsible for all content you upload, send, or share.",
      "Do not upload: illegal content, explicit sexual content, non-consensual images, violent or graphic content, copyright-infringing material, or content intended to harass or target individuals.",
      "Veilo reserves the right to remove content that violates these rules.",
    ],
  },
  {
    title: "6. Reporting & Moderation",
    content: [
      "Users may report content, messages, groups, or accounts.",
      "Veilo may review reported content, remove violating content, restrict features, suspend accounts, or permanently ban users.",
      "Moderation decisions are made to protect community safety and platform integrity.",
    ],
  },
  {
    title: "7. Account Suspension & Termination",
    content: [
      "Veilo may suspend or terminate accounts that violate these Terms, abuse anonymity, harm other users, attempt to bypass platform restrictions, or engage in unlawful activity.",
      "Repeated violations may result in permanent account removal.",
    ],
  },
  {
    title: "8. No Absolute Anonymity Guarantee",
    content: [
      "Veilo is designed to protect user privacy and anonymity from other users.",
      "However, Veilo may access account information when necessary to investigate abuse, enforce platform rules, respond to legal obligations, or protect users and platform security.",
    ],
  },
  {
    title: "9. User Responsibility",
    content: [
      "You are solely responsible for your messages, uploaded content, interactions with other users, and any information you voluntarily disclose.",
      "Think before sharing personal information.",
    ],
  },
  {
    title: "10. Intellectual Property",
    content: [
      "You retain ownership of content you create.",
      "By posting content on Veilo, you grant Veilo permission to store, display, process, and moderate that content for platform operation and safety purposes.",
    ],
  },
  {
    title: "11. Service Availability",
    content: [
      "Veilo may update, modify, suspend, or discontinue features at any time without prior notice.",
      "We do not guarantee uninterrupted availability of the service.",
    ],
  },
  {
    title: "12. Limitation of Liability",
    content: [
      "Veilo is provided on an \"as available\" basis.",
      "To the maximum extent permitted by law, Veilo shall not be liable for indirect, incidental, or consequential damages arising from use of the platform.",
    ],
  },
  {
    title: "13. Changes to These Terms",
    content: [
      "Veilo may update these Terms periodically.",
      "Continued use of the platform after changes become effective constitutes acceptance of the revised Terms.",
    ],
  },
  {
    title: "14. Acceptance",
    content: [
      "By creating an account or using Veilo, you confirm that you are a verified university student, you understand that anonymity does not exempt you from platform rules, you will use Veilo respectfully and responsibly, and you agree to these Terms of Use and Community Guidelines.",
    ],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showEmailHelp, setShowEmailHelp] = useState(false);
  
  const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
  const [currentToast, setCurrentToast] = useState<SignupEvent | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [isIncrementing, setIsIncrementing] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);

  // Load active user count on mount
  useEffect(() => {
    const fetchCount = async () => {
      const res = await getActiveUserCount();
      if (res.success && typeof res.data === "number") {
        setActiveUserCount(res.data);
      }
    };
    fetchCount();
  }, []);

  // Cycle through mock signups and trigger animated notifications & counter increments
  useEffect(() => {
    // Show first toast after 3 seconds
    const initialDelay = setTimeout(() => {
      const event = MOCK_SIGNUPS[0];
      setCurrentToast(event);
      setToastVisible(true);
      setActiveUserCount((prev) => (prev !== null ? prev + 1 : null));
      setIsIncrementing(true);
      setShowPlusOne(true);
      setTimeout(() => setIsIncrementing(false), 1200);
      setTimeout(() => setShowPlusOne(false), 2000);
      setTimeout(() => setToastVisible(false), 4500);
    }, 3000);

    const cycleInterval = setInterval(() => {
      // Pick a random event
      const randomIndex = Math.floor(Math.random() * MOCK_SIGNUPS.length);
      const event = MOCK_SIGNUPS[randomIndex];

      // 1. Show Toast
      setCurrentToast(event);
      setToastVisible(true);

      // 2. Increment active student count live by +1
      setActiveUserCount((prev) => (prev !== null ? prev + 1 : null));

      // 3. Highlight counter + show floating '+1 Student' label
      setIsIncrementing(true);
      setShowPlusOne(true);

      // Clear highlight and plus-one bubble after short duration
      setTimeout(() => {
        setIsIncrementing(false);
      }, 1200);

      setTimeout(() => {
        setShowPlusOne(false);
      }, 2000);

      // 4. Hide toast after 4.5 seconds
      setTimeout(() => {
        setToastVisible(false);
      }, 4500);

    }, 14000); // Triggers every 14 seconds to build dynamic campus activity feel

    return () => {
      clearTimeout(initialDelay);
      clearInterval(cycleInterval);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await sendOTP(email);
    setLoading(false);

    if (res.success) {
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } else {
      setErrorMsg(res.message || "Something went wrong. Please check your connection.");
    }
  };

  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-[#08080C]">
      {/* Dynamic Keyframes Injection */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes toastIn {
          0% { transform: translate(-50%, -40px) scale(0.92); opacity: 0; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes toastOut {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -40px) scale(0.92); opacity: 0; }
        }
        @keyframes counterPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); background-color: rgba(0, 240, 160, 0.25); border-color: rgba(0, 240, 160, 0.5); box-shadow: 0 0 16px rgba(0, 240, 160, 0.2); }
          100% { transform: scale(1); }
        }
        @keyframes floatBadgeUp {
          0% { transform: translateY(5px); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-22px); opacity: 0; }
        }
        @keyframes shrinkWidth {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>

      {/* Floating Verification Toast Notification */}
      {currentToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px] pointer-events-none"
        >
          <div
            className="w-full bg-[#12121A]/95 border border-[#00F0A0]/20 backdrop-blur-xl p-3.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center gap-3 pointer-events-auto overflow-hidden relative"
            style={{
              animation: toastVisible 
                ? "toastIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" 
                : "toastOut 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards"
            }}
          >
            {/* Glowing Icon Container */}
            <div className="w-10 h-10 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/35 flex items-center justify-center text-xl shrink-0 shadow-[0_0_12px_rgba(0,240,160,0.15)] animate-pulse">
              {currentToast.emoji}
            </div>
            
            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-white tracking-wide truncate">{currentToast.name}</span>
                <span className="text-[8px] bg-[#00F0A0]/10 border border-[#00F0A0]/25 text-[#00F0A0] px-1.5 py-0.5 rounded font-black font-sans uppercase shrink-0">
                  {currentToast.domain}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium font-sans truncate mt-0.5 leading-normal">
                {currentToast.action}
              </p>
            </div>

            {/* Verification status chip */}
            <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-[#00F0A0]/15 border border-[#00F0A0]/30 text-[#00F0A0] text-[10px] font-bold shadow-[0_0_8px_rgba(0,240,160,0.1)]">
              ✓
            </div>

            {/* Toast Lifetime Progress Bar */}
            {toastVisible && (
              <div 
                className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-[#00F0A0] to-[#00D2FF]"
                style={{
                  animation: "shrinkWidth 4.5s linear forwards"
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Background Decorative Blur Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-[#00F0A0]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-[#00D2FF]/5 rounded-full blur-[90px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center text-center">
        {/* Heritage Gate Architecture Illustration */}
        <div className="mb-6 opacity-35 w-full h-32 flex items-center justify-center overflow-hidden mask-image-gradient">
          <img
            alt="AMU Heritage Architecture"
            className="w-full h-full object-contain grayscale brightness-90 contrast-125 select-none"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9yvitrN1T_5K2OnwRnazBNeO2wPsMjSj4O9TBF_wge58U8vvglZe7UXFozlR1Q5tGOY8CPfVmC9VjWYY_xvY5rKGh9hDspQQ3rQYFudOKcRiv5MgAhyNlgpoOgCzyDToAFi1PPk_54ngCprzW0IPe4gfqgR9vmBUszpqm2d58JynLskIAm8Zo_4svq4xDMasEDHVAEGWHVxzUFenf1zRLgKfo1hX25g5hiPUsGzxqOUGrAMLwKWKXM6-bOFUHzxt41EqTaoRwPjaZ"
          />
        </div>

        {/* Branding */}
        <header className="mb-6 flex flex-col items-center">
          <h1 className="text-4xl font-extrabold font-heading text-white tracking-tight mb-1 bg-gradient-to-r from-white via-slate-100 to-[#00F0A0] bg-clip-text text-transparent">
            Veilo
          </h1>
          <p className="text-base text-zinc-400 font-medium">
            The anonymous heart of Aligarh.
          </p>
          <div 
            className={`flex items-center gap-1.5 mt-3.5 bg-[#00F0A0]/10 border border-[#00F0A0]/20 px-3.5 py-1.5 rounded-full relative transition-all duration-300 ${
              isIncrementing ? "shadow-[0_0_20px_rgba(0,240,160,0.25)]" : "shadow-[0_0_12px_rgba(0,240,160,0.05)]"
            }`}
            style={{
              animation: isIncrementing ? "counterPulse 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none"
            }}
          >
            <span className="w-1.5 h-1.5 bg-[#00F0A0] rounded-full shadow-[0_0_8px_rgba(0,240,160,0.6)] animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-wider font-sans select-none">
              {activeUserCount !== null ? `${activeUserCount} Active Students` : "Syncing Campus..."}
            </span>
            {showPlusOne && (
              <span 
                className="absolute -right-16 -top-1 bg-[#00F0A0] text-black font-extrabold font-sans text-[8px] px-1.5 py-0.5 rounded-md shadow-lg pointer-events-none uppercase tracking-wider"
                style={{
                  animation: "floatBadgeUp 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                }}
              >
                +1 active
              </span>
            )}
          </div>
        </header>

        {/* Dynamic Activity Spacer */}
        <div className="h-6 w-full mb-2" />

        {/* Onboarding Form Card */}
        <section className="w-full bg-[#12121A]/85 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] text-left">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-zinc-300 ml-1">
                University Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00F0A0] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg("");
                  }}
                  className={`w-full bg-[#08080C]/80 border ${
                    errorMsg ? "border-red-500/80 focus:ring-red-500/40" : "border-zinc-800 focus:border-[#00F0A0] focus:ring-[#00F0A0]/20"
                  } text-white font-sans text-base rounded-xl py-3.5 pl-11 pr-4 focus:ring-4 focus:outline-none transition-all placeholder:text-zinc-600`}
                  placeholder="yourname@myamu.ac.in"
                />
              </div>

              <div className="flex items-center justify-between mt-1">
                <p className={`text-[11px] ml-1 ${errorMsg ? "text-red-400 font-medium" : "text-zinc-500"}`}>
                  {errorMsg || "Must end with @myamu.ac.in or @amu.ac.in"}
                </p>
                {!errorMsg && (
                  <button
                    type="button"
                    onClick={() => setShowEmailHelp(true)}
                    className="text-[11px] text-[#00F0A0] hover:underline font-semibold focus:outline-none cursor-pointer"
                  >
                    No uni email?
                  </button>
                )}
              </div>
            </div>

            {/* Action button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00F0A0] text-black font-semibold text-base py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,240,160,0.2)] hover:shadow-[0_0_30px_rgba(0,240,160,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending code...
                </>
              ) : (
                <>
                  Verify &amp; Join
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Privacy disclaimer */}
          <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-start gap-3">
            <div className="text-[#00F0A0]/80 p-0.5 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              Your email is only for verification and is{" "}
              <span className="text-[#00F0A0] font-medium">never shown</span>{" "}
              to other students. We guarantee complete anonymity.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12">
          <p className="text-[11px] text-zinc-600 font-sans">
            By joining, you agree to the{" "}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="underline hover:text-[#00F0A0] transition-colors cursor-pointer"
            >
              Terms of Use &amp; Community Guidelines
            </button>
            .
          </p>
        </footer>
      </div>

      {/* Terms of Use Modal */}
      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>

          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowTerms(false)}
          />

          {/* Modal Sheet */}
          <div
            className="relative w-full sm:max-w-lg bg-[#0F0F15] border border-zinc-800/80 rounded-t-3xl sm:rounded-2xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            style={{
              maxHeight: "88vh",
              animation: "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800/60 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[#00F0A0] text-base">📋</span>
                  <h2 className="text-base font-bold text-white font-sans tracking-tight">
                    Terms of Use & Community Guidelines
                  </h2>
                </div>
                <p className="text-[10px] text-zinc-500 font-sans ml-6">Last Updated: May 2025</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 cursor-pointer shrink-0"
                aria-label="Close terms"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Intro */}
            <div className="px-6 pt-4 pb-3 shrink-0">
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                Welcome to <span className="text-[#00F0A0] font-semibold">Veilo</span> — an anonymous communication platform exclusively for verified university students. By creating an account or using Veilo, you agree to these Terms.
              </p>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">
              {TERMS_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-bold text-[#00F0A0] uppercase tracking-widest mb-2 font-sans">
                    {section.title}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-zinc-600 mt-1 shrink-0 text-[8px]">●</span>
                        <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{item}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Acceptance checkmarks */}
              <div className="mt-4 p-4 rounded-xl bg-[#00F0A0]/5 border border-[#00F0A0]/15">
                <p className="text-[10px] font-bold text-[#00F0A0] uppercase tracking-widest mb-3 font-sans">By joining, you confirm:</p>
                {[
                  "You are a verified university student",
                  "Anonymity does not exempt you from platform rules",
                  "You will use Veilo respectfully and responsibly",
                  "You agree to these Terms of Use and Community Guidelines",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                    <span className="w-4 h-4 rounded-full bg-[#00F0A0]/15 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-[8px] font-bold shrink-0">✓</span>
                    <p className="text-[11px] text-zinc-300 font-sans">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA footer */}
            <div className="px-6 py-4 border-t border-zinc-800/60 shrink-0">
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="w-full bg-[#00F0A0] text-black text-sm font-bold py-3 rounded-xl active:scale-[0.98] transition-all cursor-pointer"
              >
                I Understand, Got it
              </button>
              <p className="text-center text-[9px] text-zinc-600 mt-2 font-sans">
                Contact us at help.veilo@gmail.com for questions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Institutional Email Help Modal */}
      {showEmailHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowEmailHelp(false)}
          />

          {/* Modal Sheet */}
          <div
            className="relative w-full sm:max-w-md bg-[#0F0F15] border border-zinc-800/80 rounded-t-3xl sm:rounded-2xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            style={{
              maxHeight: "88vh",
              animation: "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#00F0A0] text-lg">🎓</span>
                <h2 className="text-base font-bold text-white font-sans tracking-tight">
                  University Email Request Guide
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailHelp(false)}
                className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 cursor-pointer shrink-0"
                aria-label="Close help"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white">Don’t Have Your AMU Email Yet?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  To use Veilo, you need your official AMU institutional email ID ending with <span className="text-white font-semibold">@myamu.ac.in</span> or <span className="text-white font-semibold">@amu.ac.in</span>.
                </p>
              </div>

              {/* Step list */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#00F0A0] uppercase tracking-widest font-sans">How to Get Your Email</h4>
                
                <div className="space-y-3.5">
                  {[
                    {
                      step: "1",
                      title: "Download Request Form",
                      desc: "Obtain the official Institutional Email Request Application Form (Proforma: CC-4) from your department or the Computer Centre downloads portal."
                    },
                    {
                      step: "2",
                      title: "Fill in Details",
                      desc: "Complete the particulars carefully. Make sure to supply your active personal email (where your OTP and final credentials will be sent)."
                    },
                    {
                      step: "3",
                      title: "HoD Verification",
                      desc: "Visit your Department Chairperson or Head of Department (HoD) office to get your application signed and officially verified."
                    },
                    {
                      step: "4",
                      title: "Submit to Computer Centre",
                      desc: "Submit the fully signed proforma to the P.M.N.F. Computer Centre, AMU, for final allocation."
                    },
                    {
                      step: "5",
                      title: "Check Personal Inbox",
                      desc: "Once verified and approved, the Computer Centre will automatically email your new credentials to your personal inbox."
                    }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/25 text-[#00F0A0] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                        {item.step}
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white">{item.title}</p>
                        <p className="text-[11px] text-zinc-400 leading-normal font-sans">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Caveat */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 leading-normal font-sans space-y-1">
                <p className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <span>⏳</span> Processing Timeline
                </p>
                <p className="text-[11px] text-zinc-500">
                  Usually, the Computer Centre processes allocations within a few days. Remember to check both your inbox and spam folders for the credentials mail.
                </p>
              </div>

              {/* Standalone Link Trigger */}
              <a
                href="https://res.cloudinary.com/dqariamo7/image/upload/v1779798484/form_institutional_mail_id_syoy2f.jpg"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 bg-zinc-900 border border-zinc-800 text-[#00F0A0] font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer text-center text-xs flex items-center justify-center gap-2 text-decoration-none"
              >
                <span>📥</span> Download Proforma Form (CC-4)
              </a>
            </div>

            {/* Support Footer */}
            <div className="px-6 py-4 border-t border-zinc-800/60 shrink-0 bg-[#0B0B10]">
              <p className="text-[11px] text-zinc-500 text-center leading-relaxed font-sans">
                Still facing issues or need assistance? <br />
                Contact us at: <a href="mailto:help.veilo@gmail.com" className="text-[#00F0A0] hover:underline font-semibold">help.veilo@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
