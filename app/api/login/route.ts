import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AUTH_COOKIE = "wright_auth";

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as {
    password?: string;
  };

  const expected = process.env.APP_PASSWORD;
  const session = process.env.SESSION_SECRET;
  if (!expected || !session) {
    return NextResponse.json(
      { error: "Auth is not configured (APP_PASSWORD / SESSION_SECRET)." },
      { status: 500 }
    );
  }
  if (!password || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year
  });
  return res;
}
