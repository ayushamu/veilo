import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // E2E Test Authentication Mock Bypass
  const mockUserId = request.cookies.get("veilo-e2e-user-id")?.value;
  if (mockUserId) {
    const originalAuth = supabase.auth;
    supabase.auth = {
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

  // Refresh token if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  
  // Public assets, mockups folder, and dev endpoints must bypass middleware
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api/media") || // Custom R2 file delivery endpoint will handle its own auth
    path.includes(".") ||
    path === "/favicon.ico" ||
    path.startsWith("/mockups")
  ) {
    return supabaseResponse;
  }

  const isAuthPage = path.startsWith("/login") || path.startsWith("/verify");
  const isOnboardingPage = path.startsWith("/onboarding");

  // 1. Not Authenticated
  if (!user) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  // 2. Authenticated - Check profile state
  let status = request.cookies.get("veilo-profile-status")?.value;

  if (!status) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile && profile.status) {
      const statusValue = profile.status;
      status = statusValue;
      // Set cookie on the response to accelerate subsequent pages
      supabaseResponse.cookies.set("veilo-profile-status", statusValue, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  if (status) {
    // If banned, block entry entirely
    if (status === "banned") {
      return new NextResponse("Access Denied: Your account has been suspended for violating campus guidelines.", { status: 403 });
    }

    // If still in onboarding status, redirect to onboarding page
    if (status === "onboarding" && !isOnboardingPage) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // If active, prevent returning to auth/onboarding pages
    if (status === "active" && (isAuthPage || isOnboardingPage)) {
      return NextResponse.redirect(new URL("/chats", request.url));
    }
  }

  return supabaseResponse;
}
