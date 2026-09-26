import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { getPhoto } from "@/lib/store";

export async function GET(request: NextRequest) {
  const photoId = request.nextUrl.searchParams.get("photoId");
  if (!photoId) {
    return NextResponse.json({ error: "Hiányzó fotó" }, { status: 400 });
  }
  const photo = await getPhoto(photoId);
  if (!photo) {
    return NextResponse.json({ error: "Nincs fotó" }, { status: 404 });
  }
  const origin = request.nextUrl.origin;
  const url = `${origin}/p/${photo.id}?t=${photo.token}`;
  const dataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 512,
    color: { dark: "#111111", light: "#ffffff" },
  });
  return NextResponse.json({ url, qr: dataUrl });
}
