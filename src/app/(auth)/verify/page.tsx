"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOTP } from "@/app/actions/auth";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (!emailParam) {
      router.push("/login");
    }
  }, [emailParam, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setErrorMsg("Please enter a valid 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

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
  };

  return (
    <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-[#00F0A0]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#00F0A0]/20 shadow-[0_0_30px_rgba(0,240,160,0.1)]">
        {/* Inbox Email Badge SVG */}
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
      </div>

      {/* Header */}
      <header className="mb-8">
        <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2">
          Verify Email
        </h2>
        <p className="text-sm text-zinc-400 font-sans leading-relaxed px-4">
          We sent a 6-digit verification code to <span className="text-white font-medium break-all">{emailParam}</span>
        </p>
      </header>

      {/* Verify Form Card */}
      <section className="w-full bg-[#12121A]/85 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] text-left">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="otp" className="text-sm font-semibold text-zinc-300 ml-1">
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
                } text-white font-sans rounded-xl py-3.5 focus:ring-4 focus:outline-none transition-all placeholder:tracking-normal placeholder:text-zinc-700`}
                placeholder="000000"
              />
            </div>
            {errorMsg && (
              <p className="text-xs text-red-400 font-medium ml-1">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00F0A0] text-black font-semibold text-base py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,240,160,0.2)] hover:shadow-[0_0_30px_rgba(0,240,160,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-black"
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
                Verifying...
              </>
            ) : (
              <>
                Confirm Code
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

        {/* Resend option */}
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
      </section>

      {/* Reset Email / Wrong email link */}
      <button
        onClick={() => router.push("/login")}
        className="mt-8 text-xs font-semibold font-sans text-zinc-500 hover:text-[#00F0A0] transition-colors cursor-pointer underline decoration-zinc-700 hover:decoration-[#00F0A0] underline-offset-4"
      >
        Wait, I entered the wrong email
      </button>
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
