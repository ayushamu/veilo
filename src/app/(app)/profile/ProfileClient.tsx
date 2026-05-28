"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/common/BottomNav";
import { signOut, setUserPassword } from "@/app/actions/auth";
import { useFcm } from "@/hooks/use-fcm";
import { updatePresencePrivacy, updateAvatarConfig } from "@/app/actions/profile";
import { VeiloAvatar, AvatarConfig } from "@/components/avatar/VeiloAvatar";
import { AvatarCustomizer } from "@/components/avatar/AvatarCustomizer";

interface ProfileSummary {
  nickname: string;
  avatar_emoji: string;
  avatar_config?: any;
  status: string;
  maskedEmail: string;
  joinedDate: string;
  blockCount: number;
  hasPassword: boolean;
  showLastSeen: boolean;
}

interface ProfileClientProps {
  profileSummary: ProfileSummary;
}

export default function ProfileClient({ profileSummary }: ProfileClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  
  // Password setting/change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [hasPasswordState, setHasPasswordState] = useState(profileSummary.hasPassword);
  const [showLastSeenState, setShowLastSeenState] = useState(profileSummary.showLastSeen);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Avatar Customizer states
  const [avatarConfigState, setAvatarConfigState] = useState<AvatarConfig>(profileSummary.avatar_config || {});
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const handleSaveAvatar = async (newConfig: AvatarConfig) => {
    setSavingAvatar(true);
    try {
      const res = await updateAvatarConfig(newConfig, profileSummary.avatar_emoji);
      if (res.success) {
        setAvatarConfigState(newConfig);
        setCustomizerOpen(false);
      } else {
        alert(res.message || "Failed to update avatar. Please try again.");
      }
    } catch (err) {
      console.error("Save avatar error:", err);
      alert("An unexpected error occurred while saving your avatar.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleTogglePresencePrivacy = async () => {
    if (privacyLoading) return;
    setPrivacyLoading(true);
    const nextVal = !showLastSeenState;
    
    // Optimistic UI update
    setShowLastSeenState(nextVal);
    
    try {
      const res = await updatePresencePrivacy(nextVal);
      if (!res.success) {
        // Revert on error
        setShowLastSeenState(!nextVal);
        alert(res.message || "Failed to update privacy preference.");
      }
    } catch (err) {
      setShowLastSeenState(!nextVal);
      console.error("Privacy toggle error:", err);
    } finally {
      setPrivacyLoading(false);
    }
  };

  const { permission, requestPermission, loading: fcmLoading } = useFcm();

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess("");

    if (!newPassword) {
      setPwdError("Password cannot be empty.");
      return;
    }

    if (newPassword.length < 6) {
      setPwdError("Password must be at least 6 characters.");
      return;
    }

    setPwdLoading(true);
    const res = await setUserPassword(newPassword);
    setPwdLoading(false);

    if (res.success) {
      setPwdSuccess("Password updated successfully!");
      setHasPasswordState(true);
      setNewPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwdSuccess("");
      }, 1500);
    } else {
      setPwdError(res.message || "Failed to update password. Please try again.");
    }
  };

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
    <main className="flex-1 flex flex-col bg-[#08080C] h-full overflow-hidden pb-28">
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
          {/* Glowing interactive avatar container */}
          <div 
            onClick={() => setCustomizerOpen(true)}
            title="Click to customize visual avatar"
            className="relative w-24 h-24 bg-[#12121A] border border-zinc-800/80 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,160,0.15)] rounded-full select-none transform hover:scale-105 cursor-pointer active:scale-95 duration-300 group overflow-hidden"
          >
            <VeiloAvatar
              seed={profileSummary.nickname}
              config={avatarConfigState}
              size={96}
              className="border-0 shadow-none hover:border-0"
            />
            {/* Edit overlay */}
            <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="bg-[#00F0A0] text-black text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Edit
              </span>
            </div>
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

            {/* Password Authentication row */}
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPwdError("");
                setPwdSuccess("");
              }}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/15 active:bg-zinc-800/35 transition-colors duration-150 text-left border-none focus:outline-none cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-zinc-900/80 p-2.5 rounded-xl text-[#00F0A0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Password Authentication</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">
                    {hasPasswordState 
                      ? "Password login active. Tap to change." 
                      : "OTP login only. Tap to set password."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  hasPasswordState ? "bg-[#00F0A0]/10 text-[#00F0A0]" : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {hasPasswordState ? "Active" : "Not Set"}
                </span>
                <svg className="text-zinc-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </button>

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

            {/* Show Last Seen Toggle row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl flex items-center justify-center transition-colors duration-150 ${showLastSeenState ? "bg-[#00F0A0]/10 text-[#00F0A0]" : "bg-zinc-900/80 text-zinc-400"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Show Last Seen</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">Let other users see when you were last active</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleTogglePresencePrivacy}
                disabled={privacyLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00F0A0]/20 ${
                  showLastSeenState ? "bg-[#00F0A0]" : "bg-zinc-800"
                } ${privacyLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showLastSeenState ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
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

            {/* Push Notifications row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl flex items-center justify-center transition-colors ${permission === "granted" ? "bg-[#00F0A0]/10 text-[#00F0A0]" : "bg-zinc-900/80 text-zinc-400"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Push Notifications</p>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">
                    {permission === "granted" 
                      ? "Realtime DM push notifications enabled" 
                      : permission === "denied"
                      ? "Notification permission is blocked by browser"
                      : "Receive push notifications when you get a DM"}
                  </p>
                </div>
              </div>
              <div>
                {permission === "granted" ? (
                  <span className="bg-[#00F0A0]/10 text-[#00F0A0] px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                    Enabled
                  </span>
                ) : permission === "denied" ? (
                  <span className="bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                    Blocked
                  </span>
                ) : (
                  <button
                    onClick={requestPermission}
                    disabled={fcmLoading}
                    className="bg-[#00F0A0] text-black hover:bg-[#00d28d] font-bold px-3 py-1.5 rounded-lg text-xs transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50 animate-pulse"
                  >
                    {fcmLoading ? "Enabling..." : "Enable"}
                  </button>
                )}
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

      {/* Password Management Modal */}
      {showPasswordModal && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => setShowPasswordModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full sm:max-w-md bg-[#12121A] border border-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl z-10">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60">
              <h4 className="text-lg font-black font-heading text-white flex items-center gap-2">
                <span className="text-[#00F0A0]">🔑</span> 
                {hasPasswordState ? "Change Password" : "Set Password"}
              </h4>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Form */}
            {pwdSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#00F0A0]/15 border border-[#00F0A0]/30 text-[#00F0A0] flex items-center justify-center text-xl mx-auto shadow-[0_0_15px_rgba(0,240,160,0.15)]">
                  ✓
                </div>
                <p className="text-sm font-bold text-white">{pwdSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="modalPassword" className="text-xs font-semibold text-zinc-400 ml-1">
                    {hasPasswordState ? "New Password" : "Password"}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00F0A0] transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <input
                      id="modalPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPwdError("");
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

                {pwdError && (
                  <p className="text-xs text-red-400 font-medium ml-1">
                    {pwdError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full py-3 bg-[#00F0A0] text-black font-bold rounded-2xl hover:bg-[#00d28d] active:scale-95 duration-150 focus:outline-none cursor-pointer text-center text-sm flex items-center justify-center gap-1.5"
                >
                  {pwdLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating...
                    </>
                  ) : (
                    hasPasswordState ? "Change Password" : "Set Password"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      <AvatarCustomizer
        seed={profileSummary.nickname}
        initialConfig={avatarConfigState}
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        onSave={handleSaveAvatar}
        isSaving={savingAvatar}
      />
    </main>
  );
}
