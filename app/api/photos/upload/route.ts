import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { createId, createToken } from "@/lib/ids";
import { savePhoto } from "@/lib/store";

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "A Vercel Blob nincs beállítva" },
      { status: 501 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        addRandomSuffix: false,
        maximumSizeInBytes: 15 * 1024 * 1024,
        tokenPayload: JSON.stringify({ pathname }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = tokenPayload
          ? (JSON.parse(tokenPayload) as { photoId?: string; roomCode?: string; captureId?: string })
          : {};
        const id = payload.photoId || createId();
        await savePhoto({
          id,
          roomCode: payload.roomCode || "GLOBAL",
          createdAt: new Date().toISOString(),
          status: "ready",
          mimeType: blob.contentType || "image/jpeg",
          size: 0,
          token: createToken(),
          blobUrl: blob.url,
          captureId: payload.captureId,
        });
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feltöltés sikertelen" },
      { status: 400 },
    );
  }
}
