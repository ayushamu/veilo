import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getE2EMockUserId } from "@/lib/security/e2e-auth";

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

  // E2E-only auth mock. Requires NODE_ENV=test and a matching secret cookie.
  const mockUserId = getE2EMockUserId(cookieStore);
  if (mockUserId) {
    const originalAuth = client.auth;
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

  return client;
}
