import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSettings, updateSettings, upsertRoom } from "@/lib/store";
import { BoothSettings } from "@/lib/types";

export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("room") || "").toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Hiányzó kód" }, { status: 400 });
  }
  const settings = await getSettings(code);
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  const body = (await request.json()) as {
    room: string;
    settings: Partial<BoothSettings>;
  };
  const code = body.room?.toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Hiányzó booth kód" }, { status: 400 });
  }
  await upsertRoom(code);
  const settings = await updateSettings(code, body.settings ?? {});
  return NextResponse.json({ settings });
}
