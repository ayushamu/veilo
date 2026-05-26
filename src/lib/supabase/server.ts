import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // E2E Test Authentication Mock Bypass
  const mockUserId = cookieStore.get("veilo-e2e-user-id")?.value;
  if (mockUserId) {
    const originalAuth = client.auth;
    client.auth = {
      ...originalAuth,
      getUser: async () => {
        return {
          data: {
            user: {
              id: mockUserId,
              email: "test@myamu.ac.in",
            } as any,
          },
          error: null,
        };
      },
    } as any;
  }

  return client;
}
