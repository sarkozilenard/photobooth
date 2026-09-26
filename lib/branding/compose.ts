import { BoothSettings, FrameStyle } from "@/lib/types";

export async function loadRoomLogo(code: string, hasLogo?: boolean) {
  if (!hasLogo) return null;
  try {
    const res = await fetch(`/api/branding/${code}/logo`);
    if (!res.ok) return null;
    return createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

async function blobToImage(blob: Blob) {
  return createImageBitmap(blob);
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("A montázs nem készült el"))),
      "image/jpeg",
      quality,
    );
  });
}

function paintFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: FrameStyle,
) {
  if (style === "booth" || style === "classic") {
    ctx.fillStyle = "#f7f4ef";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (style === "gold") {
    ctx.fillStyle = "#c4a35a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111111";
    ctx.fillRect(12, 12, width - 24, height - 24);
    return;
  }
  if (style === "minimal") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
}

export async function composeSession(
  shots: Blob[],
  settings: BoothSettings,
  logo?: ImageBitmap | null,
) {
  const images = await Promise.all(shots.map(blobToImage));
  const style = settings.frameStyle;
  const caption = settings.eventCaption.trim();
  const framed = style !== "none";
  const photoW = 900;
  const gap = framed ? 22 : 8;
  const side = framed ? (style === "booth" || style === "classic" ? 36 : 48) : 0;
  const footer = framed && (caption || logo) ? 80 : framed ? 36 : 0;
  const heights = images.map((image) =>
    Math.round(photoW * (image.height / Math.max(image.width, 1))),
  );
  const width = photoW + side * 2;
  const height =
    side +
    footer +
    heights.reduce((sum, value) => sum + value, 0) +
    gap * Math.max(images.length - 1, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nincs canvas");
  paintFrame(ctx, width, height, style);

  let y = side;
  for (let i = 0; i < images.length; i += 1) {
    ctx.drawImage(images[i], side, y, photoW, heights[i]);
    y += heights[i] + gap;
    images[i].close();
  }

  if (framed && logo) {
    const maxH = 32;
    const maxW = 240;
    const scale = Math.min(maxH / logo.height, maxW / logo.width, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, (width - w) / 2, height - footer + 16, w, h);
    logo.close();
  } else if (framed && caption) {
    ctx.fillStyle = style === "booth" || style === "classic" ? "#3f3a34" : "#f3e6c4";
    ctx.textAlign = "center";
    ctx.font = "500 22px 'Playfair Display', serif";
    ctx.fillText(caption, width / 2, height - 22, photoW);
  } else {
    logo?.close();
  }

  return canvasBlob(canvas, Math.min(settings.jpegQuality, 0.88));
}
