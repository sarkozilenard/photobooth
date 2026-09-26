import { NextRequest, NextResponse } from "next/server";
import { getSettings, isOnline, upsertRoom } from "@/lib/store";

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
