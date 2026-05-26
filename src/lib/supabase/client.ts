import { createBrowserClient } from "@supabase/ssr";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  let client;

  if (typeof window === "undefined") {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  } else {
    if (!cachedClient) {
      cachedClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    client = cachedClient;
  }

  // E2E Test Authentication Mock Bypass (evaluated dynamically at runtime)
  if (typeof window !== "undefined" && client.auth && !client.auth.getUser.toString().includes("mockUserId")) {
    const originalGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (...args: any[]) => {
      const match = document.cookie.match(/veilo-e2e-user-id=([^;]+)/);
      const mockUserId = match ? match[1] : undefined;

      if (mockUserId) {
        return {
          data: {
            user: {
              id: mockUserId,
              email: "test@myamu.ac.in",
            } as any,
          },
          error: null,
        };
      }
      return originalGetUser(...args);
    };
  }

  return client;
}
