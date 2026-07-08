import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — critical for @supabase/ssr token rotation
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/error",
    "/verify-email"
  ];
  
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route));

  // Redirect unauthenticated users to login if they try to access protected routes
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Handle Authenticated Users
  if (user) {
    // Check onboarding status from user_metadata to avoid DB query overhead
    const onboardingCompleted = user.user_metadata?.onboarding_completed === true;

    // Redirect fully authenticated users away from auth pages
    if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") {
      const url = request.nextUrl.clone();
      url.pathname = onboardingCompleted ? "/dashboard" : "/onboarding";
      return NextResponse.redirect(url);
    }

    // Enforce onboarding gate
    if (!onboardingCompleted && pathname !== "/onboarding" && pathname !== "/auth/error") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Prevent completed users from revisiting onboarding
    if (onboardingCompleted && pathname === "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Public assets
     * - API routes (we handle these separately if needed)
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
