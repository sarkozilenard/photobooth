import { NextRequest, NextResponse } from "next/server";
import { getPhoto } from "@/lib/store";

export async function POST(request: NextRequest) {
  const { photoId, email } = (await request.json()) as {
    photoId?: string;
    email?: string;
  };
  if (!photoId || !email) {
    return NextResponse.json({ error: "Hiányzó adat" }, { status: 400 });
  }
  const photo = await getPhoto(photoId);
  if (!photo) {
    return NextResponse.json({ error: "Nincs fotó" }, { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const link = `${origin}/p/${photo.id}?t=${photo.token}`;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "PHOTO BOOTH <noreply@example.com>";

  if (!key) {
    return NextResponse.json({
      ok: true,
      delivered: false,
      link,
      message: "Az e-mail küldés nincs beállítva. A letöltési link elkészült.",
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "A PHOTO BOOTH fotód",
      html: `<p>Itt a fotód:</p><p><a href="${link}">Letöltés</a></p>`,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Az e-mail küldése nem sikerült", link },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, delivered: true, link });
}
