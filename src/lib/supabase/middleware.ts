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
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile) {
    // If banned, block entry entirely
    if (profile.status === "banned") {
      return new NextResponse("Access Denied: Your account has been suspended for violating campus guidelines.", { status: 403 });
    }

    // If still in onboarding status, redirect to onboarding page
    if (profile.status === "onboarding" && !isOnboardingPage) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // If active, prevent returning to auth/onboarding pages
    if (profile.status === "active" && (isAuthPage || isOnboardingPage)) {
      return NextResponse.redirect(new URL("/chats", request.url));
    }
  }

  return supabaseResponse;
}
