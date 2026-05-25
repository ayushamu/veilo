import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veilo | Anonymous AMU Chat",
  description: "Anonymous chat platform exclusive to Aligarh Muslim University students",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veilo",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#08080C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} h-full dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="h-full bg-black flex justify-center items-stretch text-white font-sans antialiased">
        <div className="w-full max-w-[480px] min-h-full bg-background flex flex-col relative border-x border-zinc-900/50 shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
