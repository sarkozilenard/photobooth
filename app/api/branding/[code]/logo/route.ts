import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteLogo, readLogo, saveLogo, upsertRoom } from "@/lib/store";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const logo = await readLogo(code.toUpperCase());
  if (!logo) {
    return NextResponse.json({ error: "Nincs logó" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.mimeType,
      "Cache-Control": "no-cache",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  const { code } = await context.params;
  const roomCode = code.toUpperCase();
  await upsertRoom(roomCode);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Hiányzó fájl" }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  const mime =
    file.type && ALLOWED.has(file.type)
      ? file.type
      : name.endsWith(".png")
        ? "image/png"
        : name.endsWith(".webp")
          ? "image/webp"
          : name.endsWith(".gif")
            ? "image/gif"
            : name.endsWith(".jpg") || name.endsWith(".jpeg")
              ? "image/jpeg"
              : file.type;
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "PNG, JPG, WebP vagy GIF kell." },
      { status: 400 },
    );
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 2 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await saveLogo(roomCode, bytes, mime);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "A logó mentése nem sikerült. Ellenőrizd a Vercel Blob store-t." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, hasLogo: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  const { code } = await context.params;
  await deleteLogo(code.toUpperCase());
  return NextResponse.json({ ok: true, hasLogo: false });
}
