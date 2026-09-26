import { NextRequest, NextResponse } from "next/server";
import { adminPassword, setAdminSession } from "@/lib/auth";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const expected = adminPassword();
  if (!expected) {
    return NextResponse.json(
      { error: "Állítsd be az ADMIN_PASSWORD környezeti változót." },
      { status: 500 },
    );
  }
  const { password } = (await request.json()) as { password?: string };
  const given = (password ?? "").trim();
  if (!given || !safeEqual(given, expected)) {
    return NextResponse.json({ error: "Hibás jelszó" }, { status: 401 });
  }
  await setAdminSession();
  return NextResponse.json({ ok: true });
}
