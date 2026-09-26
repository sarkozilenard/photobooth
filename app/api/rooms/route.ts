import { NextResponse } from "next/server";
import { createRoomCode } from "@/lib/ids";
import { upsertRoom } from "@/lib/store";

export async function POST() {
  const code = createRoomCode();
  const room = await upsertRoom(code);
  return NextResponse.json({ room });
}
