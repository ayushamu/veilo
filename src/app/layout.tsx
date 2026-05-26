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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://velio.shop";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Veilo | Anonymous AMU Student Chat",
    template: "%s | Veilo",
  },
  description: "Connect anonymously with verified AMU students. Real-time peer discussions, campus groups, secure and private chats exclusive to @myamu.ac.in and @amu.ac.in.",
  keywords: [
    "AMU",
    "Aligarh Muslim University",
    "Veilo",
    "Anonymous Chat",
    "AMU Students",
    "College Chat",
    "Campus Network",
    "Private Messaging",
    "Secret Chat",
  ],
  authors: [{ name: "Veilo Team" }],
  creator: "Veilo Team",
  publisher: "Veilo",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Veilo",
    title: "Veilo | Anonymous Campus Chat for AMU Students",
    description: "The secure, anonymous heart of Aligarh. Join Aligarh Muslim University's official student chat platform with @myamu.ac.in or @amu.ac.in verification.",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Veilo - Anonymous Campus Chat Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Veilo | Anonymous AMU Campus Chat",
    description: "Verify your AMU student email and connect anonymously with your peers instantly.",
    images: ["/icon-512.png"],
    creator: "@veilo_chat",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veilo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
  // Setup JSON-LD structured schema for search result rich snippet enhancements
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Veilo",
    "url": APP_URL,
    "description": "Anonymous college communication network exclusively for verified AMU students.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${APP_URL}/login`,
      "query-input": "required",
    },
  };

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} h-full dark`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="h-full bg-black flex justify-center items-stretch text-white font-sans antialiased">
        <div className="w-full max-w-[480px] min-h-full bg-background flex flex-col relative border-x border-zinc-900/50 shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}

