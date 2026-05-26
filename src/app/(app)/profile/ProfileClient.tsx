"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/common/BottomNav";
import { signOut } from "@/app/actions/auth";

interface ProfileSummary {
  nickname: string;
  avatar_emoji: string;
  status: string;
  maskedEmail: string;
  joinedDate: string;
  blockCount: number;
}

interface ProfileClientProps {
  profileSummary: ProfileSummary;
}

export default function ProfileClient({ profileSummary }: ProfileClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Clear cache handler
  const handleClearCache = async () => {
    try {
      setLoading(true);
      // Clear sessionStorage and local session caches
      if (typeof window !== "undefined") {
        window.sessionStorage.clear();
        // Remove warm inbox key to force resync
        window.localStorage.removeItem("veilo_warm_inbox");
        // Reload page to reflect fresh states
        window.location.reload();
      }
    } catch (err) {
      console.error("Cache clear failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      setLoading(true);
      const res = await signOut();
      if (res.success) {
        // Successful sign out -> flush and redirect
        router.push("/login");
        router.refresh();
      } else {
        alert(res.message || "Failed to sign out. Please try again.");
      }
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-[#08080C] min-h-screen pb-28">
      {/* 1. Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#08080C]/85 backdrop-blur-md border-b border-zinc-900/60 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold font-heading text-white tracking-tight">
          Profile
        </h1>
        
        {/* Floating action indicator */}
        <span className="w-2.5 h-2.5 bg-[#00F0A0] rounded-full shadow-[0_0_8px_rgba(0,240,160,0.6)]" />
      </header>

      {/* 2. Maximum Centered Mobile Viewport Content Container */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 space-y-6 w-full max-w-[480px] mx-auto">
        
        {/* Identity Hero */}
        <section className="flex flex-col items-center text-center space-y-4 py-4 bg-gradient-to-b from-[#12121A]/35 to-transparent rounded-3xl border border-zinc-900/40 p-5">
          {/* Glowing emoji avatar container */}
          <div className="w-24 h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center text-5xl shadow-[0_0_20px_rgba(0,240,160,0.15)] rounded-full select-none transform hover:scale-105 duration-300">
            {profileSummary.avatar_emoji}
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black font-heading text-white tracking-tight">
              {profileSummary.nickname}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="bg-[#00F0A0]/10 border border-[#00F0A0]/25 text-[#00F0A0] px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                Verified AMU
              </span>
              <span className="bg-zinc-900 text-zinc-400 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Anonymous Identity
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-sans pt-1 max-w-[320px]">
              Your email is protected by Veilo's cryptographic privacy isolation boundary.
            </p>
          </div>
        </section>

        {/* Account & Security Settings Group */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 px-1.5">
            Account &amp; Security
          </h3>
          <div className="bg-[#12121A]/70 backdrop-blur-md rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/40">
            {/* Masked Email row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">University Email</p>
                  <p className="text-xs text-zinc-500 font-sans tracking-wide mt-0.5">{profileSummary.maskedEmail}</p>
                </div>
              </div>
              <svg className="text-[#00F0A0] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
            </div>
            
            {/* Account Status row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Account Status</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Active Student Profile</p>
                </div>
              </div>
              <span className="bg-[#00F0A0]/10 text-[#00F0A0] px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                {profileSummary.status}
              </span>
            </div>

            {/* Joined date row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Joined Veilo</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">{profileSummary.joinedDate}</p>
                </div>
              </div>
            </div>

            {/* Cryptographic Isolation Lock info row */}
            <div className="p-4 flex items-start gap-3.5">
              <div className="bg-zinc-900/80 p-2.5 rounded-xl text-zinc-400 flex items-center justify-center mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-300">Identity Cryptographic Lock</p>
                <p className="text-[11px] text-zinc-500 leading-normal font-sans">
                  Each student email address is bound to a single active profile. Account hashes are permanently isolated in a secure ledger to enforce absolute peer anonymity.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Controls Settings Group */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 px-1.5">
            Privacy Controls
          </h3>
          <div className="bg-[#12121A]/70 backdrop-blur-md rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/40">
            {/* Email Isolation row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Email Isolation Boundary</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Your email address is strictly hidden from other peers</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 font-sans uppercase">Active</span>
            </div>

            {/* Anonymous Messaging row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Anonymous Messaging</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Other students only see your nickname and avatar</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 font-sans uppercase">Active</span>
            </div>

            {/* Secure Media Proxy row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Media Secure Proxy</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Images are validated through authenticated room checks</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 font-sans uppercase">Active</span>
            </div>

            {/* Clear cache row */}
            <button
              onClick={handleClearCache}
              disabled={loading}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/15 active:bg-zinc-800/35 transition-colors duration-150 text-left border-none focus:outline-none cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-zinc-400 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"></path><path d="M3 13a9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9 9.07 9.07 0 0 0-6 2.3L3 8"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Clear Local Cache</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Clears session state and reloads local database preview</p>
                </div>
              </div>
              <svg className="text-zinc-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        {/* Safety Settings Group */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 px-1.5">
            Campus Safety
          </h3>
          <div className="bg-[#12121A]/70 backdrop-blur-md rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/40">
            {/* Blocked Users count row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Blocked Identities</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Identities you've restricted from messaging you</p>
                </div>
              </div>
              <span className="bg-zinc-900 text-zinc-400 font-bold px-3 py-0.5 rounded-full text-[10px]">
                {profileSummary.blockCount}
              </span>
            </div>

            {/* Contact safety team mailto */}
            <a
              href="mailto:help.veilo@gmail.com?subject=[Veilo Support Ticket] Anonymous Safety Violation&body=Please provide the nickname of the student (if known) and details of the safety violation here. Our team will review the chat logs immediately.%0A%0A---%0AReported Room ID: [Add Room ID if applicable]"
              className="p-4 flex items-center justify-between hover:bg-zinc-800/15 active:bg-zinc-800/35 transition-colors duration-150 text-left border-none focus:outline-none cursor-pointer text-decoration-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Contact Safety Team</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Submit safety report directly to help.veilo@gmail.com</p>
                </div>
              </div>
              <svg className="text-zinc-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </a>

            {/* Community Rules dialog trigger */}
            <button
              onClick={() => setShowRulesModal(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/15 active:bg-zinc-800/35 transition-colors duration-150 text-left border-none focus:outline-none cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-zinc-400 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Community Rules</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Core guidelines and respect policies of Veilo campus chat</p>
                </div>
              </div>
              <svg className="text-zinc-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        {/* App Controls Settings Group */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 px-1.5">
            Preferences &amp; System
          </h3>
          <div className="bg-[#12121A]/70 backdrop-blur-md rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/40">
            {/* Install PWA Instruction row */}
            <div className="p-4 flex items-center gap-3.5">
              <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-white">Install Veilo PWA</p>
                <p className="text-xs text-zinc-500 font-sans">Open browser share settings and select "Add to Home Screen" to install</p>
              </div>
            </div>

            {/* Log Out row */}
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full p-4 flex items-center justify-between hover:bg-red-500/5 active:bg-red-500/15 transition-colors duration-150 text-left border-none focus:outline-none cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-500">Sign Out</p>
                  <p className="text-xs text-red-500/60 font-sans mt-0.5">Flushes local session cookies and logs you out securely</p>
                </div>
              </div>
              <svg className="text-red-500/40" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        {/* Footer Build details */}
        <footer className="text-center pt-2 pb-6 space-y-1.5">
          <p className="text-[10px] text-zinc-600 font-sans font-bold tracking-widest uppercase">
            Veilo App v1.0.0 (AMU Connect)
          </p>
        </footer>

      </div>

      {/* 3. Tab Bar Navigation */}
      <BottomNav activeTab="profile" />

      {/* Community Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12121A] border border-zinc-900 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <h4 className="text-lg font-black font-heading text-white flex items-center gap-2">
              <span className="text-[#00F0A0]">🛡️</span> Community Guidelines
            </h4>
            
            <div className="space-y-3.5 text-xs text-zinc-400 leading-relaxed font-sans overflow-y-auto max-h-[300px] pr-1.5">
              <p>
                Welcome to Veilo campus network. To keep our Aligarh student community positive and safe, please read and follow these rules:
              </p>
              <ul className="list-disc pl-4 space-y-2">
                <li>
                  <strong className="text-white">Respect Anonymity:</strong> Do not attempt to guess or expose the real-world identity of other users. Peer-to-peer anonymity is absolute and permanent.
                </li>
                <li>
                  <strong className="text-white">No Harassment or Bullying:</strong> Do not target other students with abusive language, threats, stalking, or hostile behavior.
                </li>
                <li>
                  <strong className="text-white">Zero Tolerance for Spam:</strong> Do not spam public channels with commercial links, unauthorized promotions, or repetitive content.
                </li>
                <li>
                  <strong className="text-white">No Explicit/Illegal Media:</strong> Sharing illegal, highly graphic, or explicit sexual images violates campus rules and will result in an immediate profile ban.
                </li>
              </ul>
              <p className="bg-[#08080C] p-3 border border-zinc-900 rounded-xl text-[#00F0A0]/80">
                Safety reports are audited directly by moderators. Users who violate these rules are subject to immediate, permanent account suspensions.
              </p>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 bg-[#00F0A0] text-black font-bold rounded-2xl hover:bg-[#00d28d] active:scale-95 duration-150 focus:outline-none cursor-pointer text-center text-sm"
            >
              Accept Guidelines
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
