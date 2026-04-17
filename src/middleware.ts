import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const VISITOR_COOKIE = "ss_vid";
const MAX_AGE_SEC = 60 * 60 * 24 * 400;

export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  if (!request.cookies.get(VISITOR_COOKIE)?.value) {
    res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SEC,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
