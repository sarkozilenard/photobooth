import { NextRequest, NextResponse } from "next/server";
import { getRoom, isOnline, touchPresence } from "@/lib/store";
import { DeviceRole } from "@/lib/types";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const roomCode = code.toUpperCase();
  const { role } = (await request.json()) as { role: DeviceRole };
  const room = await touchPresence(roomCode, role);
  if (!room) {
    return NextResponse.json({ error: "Nincs booth" }, { status: 404 });
  }
  return NextResponse.json({
    cameraOnline: isOnline(room.cameraLastSeen),
    boothOnline: isOnline(room.boothLastSeen),
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await getRoom(code.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: "Nincs booth" }, { status: 404 });
  }
  return NextResponse.json({
    cameraOnline: isOnline(room.cameraLastSeen),
    boothOnline: isOnline(room.boothLastSeen),
  });
}
