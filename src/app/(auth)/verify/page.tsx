"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOTP, verifyResetOTP, setUserPassword } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const flow = searchParams.get("flow") || ""; // "signup" | "reset" | ""

  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"verify" | "new_password">("verify");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (!emailParam) {
      router.push("/login");
    }
  }, [emailParam, router]);

  useEffect(() => {
    if (resendCooldown <= 0 || step !== "verify") return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown, step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (step === "verify") {
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        setErrorMsg("Please enter a valid 6-digit verification code.");
        return;
      }

      setLoading(true);

      if (flow === "reset") {
        const res = await verifyResetOTP(emailParam, otp);
        setLoading(false);

        if (res.success) {
          setStep("new_password");
        } else {
          setErrorMsg(res.message || "Incorrect verification code. Please check and try again.");
        }
      } else {
        // signup or normal OTP login
        const res = await verifyOTP(emailParam, otp);
        setLoading(false);

        if (res.success && res.data) {
          if (res.data.status === "onboarding") {
            router.push("/onboarding");
          } else {
            router.push("/chats");
          }
        } else {
          setErrorMsg(res.message || "Incorrect verification code. Please check and try again.");
        }
      }
    } else {
      // Step: new_password (recovery flow)
      if (!newPassword) {
        setErrorMsg("Please enter your new password.");
        return;
      }
      if (newPassword.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }

      setLoading(true);
      const res = await setUserPassword(newPassword);

      let status = "onboarding";
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("status")
            .eq("id", user.id)
            .single();
          if (profile) status = profile.status;
        }
      } catch (err) {
        console.error("Error checking profile status during reset:", err);
      }
      setLoading(false);

      if (res.success) {
        if (status === "onboarding") {
          router.push("/onboarding");
        } else {
          router.push("/chats");
        }
      } else {
        setErrorMsg(res.message || "Failed to set new password. Please try again.");
      }
    }
  };

  return (
    <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-[#00F0A0]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#00F0A0]/20 shadow-[0_0_30px_rgba(0,240,160,0.1)]">
        {step === "verify" ? (
          /* Inbox Email Badge SVG */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00F0A0"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        ) : (
          /* Lock SVG */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00F0A0"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>

      {/* Header */}
      <header className="mb-8">
        <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2">
          {step === "verify" ? "Verify Email" : "New Password"}
        </h2>
        <p className="text-sm text-zinc-400 font-sans leading-relaxed px-4">
          {step === "verify" ? (
            <>
              We sent a 6-digit verification code to <span className="text-white font-medium break-all">{emailParam}</span>
            </>
          ) : (
            "Create a new password to secure your account."
          )}
        </p>
      </header>

      {/* Verify / Password Form Card */}
      <section className="w-full bg-[#12121A]/85 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] text-left">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {step === "verify" ? (
            <div className="space-y-2">
              <label htmlFor="otp" className="text-xs font-semibold text-zinc-300 ml-1">
                6-Digit Code
              </label>
              <div className="relative">
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  pattern="\d{6}"
                  inputMode="numeric"
                  required
                  value={otp}
                  onChange={(e) => {
                    // Only allow digits
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                    setErrorMsg("");
                  }}
                  className={`w-full bg-[#08080C]/80 border tracking-[0.5em] text-center text-xl font-bold ${
                    errorMsg ? "border-red-500/80 focus:ring-red-500/40" : "border-zinc-800 focus:border-[#00F0A0] focus:ring-[#00F0A0]/20"
                  } text-white font-sans rounded-xl py-3 focus:ring-4 focus:outline-none transition-all placeholder:tracking-normal placeholder:text-zinc-700`}
                  placeholder="000000"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-xs font-semibold text-zinc-300 ml-1">
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
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
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
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-400 font-medium ml-1">
              {errorMsg}
            </p>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00F0A0] text-black font-semibold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,240,160,0.2)] hover:shadow-[0_0_30px_rgba(0,240,160,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
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
                Processing...
              </>
            ) : (
              <>
                {step === "verify" ? "Confirm Code" : "Set Password"}
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
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Resend option (Only shown on verify step) */}
        {step === "verify" && (
          <div className="mt-5 text-center">
            <p className="text-xs text-zinc-500 font-sans">
              Didn&apos;t receive the email?{" "}
              {resendCooldown > 0 ? (
                <span className="text-zinc-400 font-medium">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  onClick={() => {
                    setResendCooldown(60);
                    router.push(`/login`);
                  }}
                  className="text-[#00F0A0] font-semibold hover:underline cursor-pointer"
                >
                  Resend OTP
                </button>
              )}
            </p>
          </div>
        )}
      </section>

      {/* Reset Email / Wrong email link */}
      {step === "verify" && (
        <button
          onClick={() => router.push("/login")}
          className="mt-8 text-xs font-semibold font-sans text-zinc-500 hover:text-[#00F0A0] transition-colors cursor-pointer underline decoration-zinc-700 hover:decoration-[#00F0A0] underline-offset-4"
        >
          Wait, I entered the wrong email
        </button>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-[#08080C]">
      {/* Background Decorative Blur Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-[#00F0A0]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-[#00D2FF]/5 rounded-full blur-[90px]" />
      </div>

      <Suspense
        fallback={
          <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center justify-center text-center">
            <svg
              className="animate-spin h-10 w-10 text-[#00F0A0] mb-4"
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
            <p className="text-zinc-400 text-sm">Loading verification content...</p>
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </main>
  );
}
