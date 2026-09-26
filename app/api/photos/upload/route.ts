import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "A feltöltés a /api/photos útvonalon megy, Cloudflare R2-re." },
    { status: 410 },
  );
}
