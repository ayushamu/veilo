"use client";

import { useState, useEffect } from "react";
import { setUserPassword } from "@/app/actions/auth";

interface PasswordPromptProps {
  hasPassword: boolean;
}

export default function PasswordPrompt({ hasPassword }: PasswordPromptProps) {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    console.log("[PasswordPrompt] Mounting with hasPassword prop:", hasPassword);
    // Only show if the user does not have a password set
    if (!hasPassword) {
      const cooldown = localStorage.getItem("veilo-pwd-prompt-cooldown");
      const now = Date.now();
      console.log("[PasswordPrompt] Cooldown value in localStorage:", cooldown);
      
      // If no cooldown or cooldown has expired (3 days = 3 * 24 * 60 * 60 * 1000)
      const cooldownExpired = !cooldown || now - parseInt(cooldown, 10) > 3 * 24 * 60 * 60 * 1000;
      console.log("[PasswordPrompt] Cooldown expired:", cooldownExpired);
      
      if (cooldownExpired) {
        console.log("[PasswordPrompt] Scheduling showing of modal in 2 seconds...");
        // Show after a brief delay so it feels organic
        const timer = setTimeout(() => {
          console.log("[PasswordPrompt] Showing modal now!");
          setShow(true);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        const remainingMs = 3 * 24 * 60 * 60 * 1000 - (now - parseInt(cooldown!, 10));
        console.log(`[PasswordPrompt] Modal in cooldown. Remaining time: ${Math.round(remainingMs / 1000 / 60)} minutes.`);
      }
    } else {
      console.log("[PasswordPrompt] Skipping modal because user already has a password set.");
    }
  }, [hasPassword]);

  const handleDismiss = () => {
    // Set 3-day cooldown in localStorage
    localStorage.setItem("veilo-pwd-prompt-cooldown", Date.now().toString());
    setShow(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!password) {
      setErrorMsg("Password cannot be empty.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const res = await setUserPassword(password);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      // Automatically hide after 2 seconds on success
      setTimeout(() => {
        setShow(false);
      }, 2000);
    } else {
      setErrorMsg(res.message || "Failed to set password. Please try again.");
    }
  };

  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.25s ease-out" }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop click dismisses but sets cooldown */}
      <div className="absolute inset-0" onClick={handleDismiss} />

      {/* Modal Container */}
      <div
        className="relative w-full sm:max-w-md bg-[#0F0F15] border border-zinc-800/80 rounded-t-3xl sm:rounded-2xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] overflow-hidden p-6 z-10"
        style={{
          animation: "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#00F0A0]/10 border border-[#00F0A0]/25 flex items-center justify-center text-2xl shrink-0 shadow-[0_0_15px_rgba(0,240,160,0.1)]">
                ⚡
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-white font-sans tracking-tight">
                  Enable Instant Login
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Tired of waiting for email codes? Set a password now to log in instantly next time.
                </p>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 ml-1">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00F0A0] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg("");
                    }}
                    placeholder="At least 6 characters"
                    className="w-full bg-[#08080C]/80 border border-zinc-800 focus:border-[#00F0A0] focus:ring-[#00F0A0]/20 text-white font-sans text-sm rounded-xl py-3 pl-11 pr-12 focus:ring-4 focus:outline-none transition-all placeholder:text-zinc-600"
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

              {errorMsg && (
                <p className="text-xs text-red-400 font-medium ml-1">
                  {errorMsg}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 py-3 border border-zinc-800 hover:border-zinc-700 text-zinc-400 font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer text-center text-xs"
              >
                Maybe Later
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-[#00F0A0] hover:bg-[#00d28d] text-black font-bold rounded-xl active:scale-[0.98] transition-all duration-200 cursor-pointer text-center text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,240,160,0.15)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Upgrade Account"
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#00F0A0]/15 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-3xl mx-auto shadow-[0_0_20px_rgba(0,240,160,0.2)]">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white font-heading">
                Instant Login Enabled!
              </h3>
              <p className="text-xs text-zinc-400 font-sans px-4">
                Your account is now upgraded. You can log in using your password from next time.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
