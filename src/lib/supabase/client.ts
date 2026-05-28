import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;
const E2E_USER_COOKIE = "veilo-e2e-user-id";

function getBrowserE2EMockUserId() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_VEILO_E2E_AUTH_ENABLED !== "true"
  ) {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${E2E_USER_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function createClient() {
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (!cachedClient) {
    cachedClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const mockUserId = getBrowserE2EMockUserId();
    if (mockUserId) {
      const originalAuth = cachedClient.auth;
      originalAuth.getUser = async () => {
        return {
          data: {
            user: {
              id: mockUserId,
              email: "test@myamu.ac.in",
            } as User,
          },
          error: null,
        };
      };
    }
  }

  return cachedClient;
}
