import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://velio.shop";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login"],
      disallow: [
        "/chats",
        "/chats/",
        "/profile",
        "/profile/",
        "/onboarding",
        "/onboarding/",
        "/verify",
        "/verify/",
        "/api",
        "/api/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
