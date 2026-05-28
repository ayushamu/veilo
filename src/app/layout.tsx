import type { Metadata, Viewport } from "next";
import { Outfit, Inter, Hanken_Grotesk } from "next/font/google";
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

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://veilo.shop";

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
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
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
  interactiveWidget: "resizes-content",
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
      className={`${outfit.variable} ${inter.variable} ${hankenGrotesk.variable} h-full dark`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full bg-black text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

