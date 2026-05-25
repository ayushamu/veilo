"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendOTP } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await sendOTP(email);
    setLoading(false);

    if (res.success) {
      // Redirect to verification screen with email prefilled
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } else {
      setErrorMsg(res.message || "Something went wrong. Please check your connection.");
    }
  };

  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-[#08080C]">
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
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold font-heading text-white tracking-tight mb-1 bg-gradient-to-r from-white via-slate-100 to-[#00F0A0] bg-clip-text text-transparent">
            Veilo
          </h1>
          <p className="text-base text-zinc-400 font-medium">
            The anonymous heart of Aligarh.
          </p>
        </header>

        {/* Onboarding Form Card */}
        <section className="w-full bg-[#12121A]/85 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] text-left">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-zinc-300 ml-1">
                University Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00F0A0] transition-colors">
                  {/* Alternate Email SVG */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
              
              {/* Validation helper text */}
              <p className={`text-xs ml-1 ${errorMsg ? "text-red-400 font-medium" : "text-zinc-500"}`}>
                {errorMsg || "Must end with @myamu.ac.in or @amu.ac.in"}
              </p>
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
                  Sending code...
                </>
              ) : (
                <>
                  Verify & Join
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
              {/* Padlock SVG */}
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              Your email is only for verification and is <span className="text-[#00F0A0] font-medium">never shown</span> to other students. We guarantee complete anonymity.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12">
          <p className="text-[11px] text-zinc-600 font-sans">
            By joining, you agree to the{" "}
            <a href="#" className="underline hover:text-[#00F0A0] transition-colors">
              Aligarh Code of Conduct
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
