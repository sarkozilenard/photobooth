import { NextResponse } from "next/server";
import { listPackagedLogos } from "@/lib/branding/packaged-logos";

export const dynamic = "force-dynamic";

export async function GET() {
  const logos = await listPackagedLogos();
  return NextResponse.json({ logos });
}
