"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendOTP, signInWithPassword, signUpWithPassword, sendPasswordReset } from "@/app/actions/auth";
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
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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

    const sanitizedEmail = email.trim().toLowerCase();

    const isDeveloper =
      process.env.NODE_ENV !== "production" && sanitizedEmail === "ayushcmf@gmail.com";
    const isStudentEmail = /^[a-z]{2}[0-9]{4}@(myamu\.ac\.in|amu\.ac\.in)$/.test(sanitizedEmail);

    if (!isDeveloper && !isStudentEmail) {
      setLoading(false);
      setErrorMsg("Student email must start with your 6-character Enrollment Number (e.g., GP1234@myamu.ac.in).");
      return;
    }

    if (activeTab === "signin") {
      if (loginMode === "password") {
        if (!password) {
          setErrorMsg("Please enter your password.");
          setLoading(false);
          return;
        }
        const res = await signInWithPassword(sanitizedEmail, password);
        setLoading(false);

        if (res.success && res.data) {
          if (res.data.status === "onboarding") {
            router.push("/onboarding");
          } else {
            router.push("/chats");
          }
        } else {
          setErrorMsg(res.message || "Incorrect email or password. Please try again.");
        }
      } else {
        // OTP Mode login
        const res = await sendOTP(sanitizedEmail);
        setLoading(false);

        if (res.success) {
          router.push(`/verify?email=${encodeURIComponent(sanitizedEmail)}`);
        } else {
          setErrorMsg(res.message || "Failed to trigger verification code. Please try again.");
        }
      }
    } else {
      // Create Account (Sign Up)
      if (!password) {
        setErrorMsg("Please enter a password.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      const res = await signUpWithPassword(sanitizedEmail, password);
      setLoading(false);

      if (res.success) {
        router.push(`/verify?email=${encodeURIComponent(sanitizedEmail)}&flow=signup`);
      } else {
        setErrorMsg(res.message || "Failed to create account. Please try again.");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg("Please enter your email address first to reset password.");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
    const sanitizedEmail = email.trim().toLowerCase();

    const isDeveloper =
      process.env.NODE_ENV !== "production" && sanitizedEmail === "ayushcmf@gmail.com";
    const isStudentEmail = /^[a-z]{2}[0-9]{4}@(myamu\.ac\.in|amu\.ac\.in)$/.test(sanitizedEmail);

    if (!isDeveloper && !isStudentEmail) {
      setLoading(false);
      setErrorMsg("Student email must start with your 6-character Enrollment Number (e.g., GP1234@myamu.ac.in).");
      return;
    }
    
    const res = await sendPasswordReset(sanitizedEmail);
    setLoading(false);

    if (res.success) {
      router.push(`/verify?email=${encodeURIComponent(sanitizedEmail)}&flow=reset`);
    } else {
      setErrorMsg(res.message || "Failed to send reset code. Please try again.");
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
          className="absolute top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px] pointer-events-none"
          style={{
            animation: toastVisible 
              ? "toastIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" 
              : "toastOut 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards"
          }}
        >
          <div
            className="w-full bg-[#12121A]/95 border border-[#00F0A0]/20 backdrop-blur-xl p-3.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center gap-3 pointer-events-auto overflow-hidden relative"
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
          {/* Tab Selector */}
          <div className="flex bg-[#08080C]/80 p-1 rounded-xl border border-zinc-900 mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "signin"
                  ? "bg-[#00F0A0] text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("signup");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "signup"
                  ? "bg-[#00F0A0] text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-300 ml-1">
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
                  } text-white font-sans text-sm rounded-xl py-3 pl-11 pr-4 focus:ring-4 focus:outline-none transition-all placeholder:text-zinc-600`}
                  placeholder="yourname@myamu.ac.in"
                />
              </div>
            </div>

            {/* Password Fields */}
            {activeTab === "signin" ? (
              // Sign In Fields
              loginMode === "password" ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label htmlFor="password" className="text-xs font-semibold text-zinc-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] text-[#00F0A0] hover:underline font-semibold focus:outline-none cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00F0A0] transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg("");
                      }}
                      className="w-full bg-[#08080C]/80 border border-zinc-800 focus:border-[#00F0A0] focus:ring-[#00F0A0]/20 text-white font-sans text-sm rounded-xl py-3 pl-11 pr-12 focus:ring-4 focus:outline-none transition-all placeholder:text-zinc-600"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors focus:outline-none cursor-pointer"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ) : null
            ) : (
              // Create Account Fields
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-zinc-300 ml-1">
                  Choose Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00F0A0] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg("");
                    }}
                    className="w-full bg-[#08080C]/80 border border-zinc-800 focus:border-[#00F0A0] focus:ring-[#00F0A0]/20 text-white font-sans text-sm rounded-xl py-3 pl-11 pr-12 focus:ring-4 focus:outline-none transition-all placeholder:text-zinc-600"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message and Help Links */}
            <div className="flex items-center justify-between mt-1">
              <p className={`text-[10px] ml-1 ${errorMsg ? "text-red-400 font-medium" : "text-zinc-500"}`}>
                {errorMsg || "Must end with @myamu.ac.in or @amu.ac.in"}
              </p>
              {!errorMsg && (
                <button
                  type="button"
                  onClick={() => setShowEmailHelp(true)}
                  className="text-[10px] text-[#00F0A0] hover:underline font-semibold focus:outline-none cursor-pointer"
                >
                  No uni email?
                </button>
              )}
            </div>

            {/* Action button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00F0A0] text-black font-semibold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,240,160,0.2)] hover:shadow-[0_0_30px_rgba(0,240,160,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  {activeTab === "signin"
                    ? loginMode === "password"
                      ? "Sign In"
                      : "Send Verification Code"
                    : "Create Account & Verify"}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>

            {/* Sign In Mode Toggle */}
            {activeTab === "signin" && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode(loginMode === "password" ? "otp" : "password");
                    setErrorMsg("");
                  }}
                  className="text-[11px] text-[#00F0A0]/90 hover:text-[#00F0A0] hover:underline font-semibold focus:outline-none cursor-pointer"
                >
                  {loginMode === "password"
                    ? "Sign in with Verification Code (OTP) instead"
                    : "Sign in with Password instead"}
                </button>
              </div>
            )}
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
        <footer className="mt-12 space-y-2">
          <p className="text-[11px] text-zinc-600 font-sans leading-relaxed">
            By joining, you agree to the{" "}
            <Link
              href="/terms"
              className="underline hover:text-[#00F0A0] transition-colors"
            >
              Terms of Service
            </Link>{" "}
            &amp;{" "}
            <Link
              href="/privacy"
              className="underline hover:text-[#00F0A0] transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-[11px] text-zinc-500 font-sans">
            Follow us on Instagram:{" "}
            <a
              href="https://instagram.com/veilo.chat"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#00F0A0] transition-colors font-medium text-zinc-500"
            >
              @veilo.chat
            </a>
          </p>
        </footer>
      </div>

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
