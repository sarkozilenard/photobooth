import { NextRequest, NextResponse } from "next/server";
import { getSettings, isOnline, updateSettings, upsertRoom } from "@/lib/store";
import { BoothSettings } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await upsertRoom(code.toUpperCase());
  const settings = await getSettings(room.code);
  return NextResponse.json({
    room,
    settings,
    cameraOnline: isOnline(room.cameraLastSeen),
    boothOnline: isOnline(room.boothLastSeen),
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const roomCode = code.toUpperCase();
  await upsertRoom(roomCode);
  const body = (await request.json()) as { settings?: Partial<BoothSettings> };
  if (!body.settings) {
    return NextResponse.json({ error: "Hiányzó beállítások" }, { status: 400 });
  }
  const settings = await updateSettings(roomCode, body.settings);
  return NextResponse.json({ settings });
}
