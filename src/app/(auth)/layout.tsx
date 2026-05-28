import React from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex justify-center items-stretch h-[100dvh] bg-black overflow-hidden">
      <div className="w-full max-w-[480px] h-full bg-background flex flex-col relative border-x border-zinc-900/50 shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
