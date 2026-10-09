import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/signup", "/verify", "/forgot", "/reset", "/api/auth", "/api/health"];

// Vérification optimiste (présence du cookie) ; l'autorisation réelle se fait côté serveur.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (getSessionCookie(req)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/|favicon.ico|manifest.webmanifest|icon|sw.js).*)"] };
