import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deletePhoto, getPhoto } from "@/lib/store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) {
    return NextResponse.json({ error: "Nincs fotó" }, { status: 404 });
  }
  const token = request.nextUrl.searchParams.get("t");
  if (token !== photo.token && !(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  return NextResponse.json({ photo });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  const { id } = await context.params;
  const photo = await deletePhoto(id);
  if (!photo) {
    return NextResponse.json({ error: "Nincs fotó" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
