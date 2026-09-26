import { NextRequest, NextResponse } from "next/server";
import { getRoom, getSettings, isOnline } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await getRoom(code.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: "Nincs ilyen booth" }, { status: 404 });
  }
  const settings = await getSettings(room.code);
  return NextResponse.json({
    room,
    settings,
    cameraOnline: isOnline(room.cameraLastSeen),
    boothOnline: isOnline(room.boothLastSeen),
  });
}
