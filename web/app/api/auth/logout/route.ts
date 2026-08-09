import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

// Clear the account session. (B-hyve disconnect is a separate endpoint.)
export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCOUNT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
