import { NextRequest, NextResponse } from "next/server";
import { createId } from "@/lib/ids";
import {
  getRoom,
  isOnline,
  pushSignal,
  readSignals,
  touchPresence,
  upsertRoom,
} from "@/lib/store";
import { DeviceRole, SignalMessage } from "@/lib/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const roomCode = code.toUpperCase();
  const room = await getRoom(roomCode);
  const after = Number(request.nextUrl.searchParams.get("after") || "0");
  const messages = room ? await readSignals(roomCode, after) : [];
  return NextResponse.json({
    messages,
    cameraOnline: room ? isOnline(room.cameraLastSeen) : false,
    boothOnline: room ? isOnline(room.boothLastSeen) : false,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const roomCode = code.toUpperCase();
  await upsertRoom(roomCode);

  const body = (await request.json()) as Partial<SignalMessage> & {
    from: DeviceRole;
  };

  const message: SignalMessage = {
    id: createId(),
    roomCode,
    from: body.from,
    kind: body.kind ?? "control",
    ts: Date.now(),
    sdp: body.sdp,
    candidate: body.candidate,
    control: body.control,
  };

  await pushSignal(message);
  await touchPresence(roomCode, body.from);
  return NextResponse.json({ ok: true, message });
}
