import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col justify-center items-center bg-[#08080C] min-h-screen px-6 text-center">
      <div className="absolute inset-0 bg-radial-gradient from-[#00F0A0]/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center">
        {/* Glowy 404 Circle */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800/80 flex items-center justify-center text-4xl shadow-xl relative select-none mb-6 animate-pulse">
          🔍
          <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FF4B72] border-2 border-[#08080C] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_8px_rgba(255,75,114,0.6)]">
            404
          </span>
        </div>

        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-3">
          Room Vanished
        </h1>
        
        <p className="text-sm text-zinc-400 font-sans max-w-xs mb-8 leading-relaxed">
          The chat room you are looking for has either been deleted, archived, or never existed in the campus database.
        </p>

        <Link
          href="/chats"
          className="bg-gradient-to-r from-[#00F0A0] to-[#00D2FF] text-black font-extrabold font-sans text-sm rounded-full px-8 py-3.5 shadow-[0_0_20px_rgba(0,240,160,0.3)] hover:shadow-[0_0_30px_rgba(0,240,160,0.5)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          Back to Chats
        </Link>
      </div>
    </main>
  );
}
