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
  if (style === "gold") {
    ctx.fillStyle = "#c4a35a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111111";
    ctx.fillRect(14, 14, width - 28, height - 28);
    ctx.strokeStyle = "#e8d5a3";
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, width - 52, height - 52);
    return;
  }
  if (style === "classic") {
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (style === "minimal") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, width - 24, height - 24);
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
  const contentW = 1080;
  const gap = 22;
  const header = logo ? 220 : 150;
  const footer = settings.eventCaption.trim() ? 110 : 78;
  const side = settings.frameStyle === "none" ? 40 : 64;
  const photoHeights = images.map((image) =>
    Math.round(contentW * (image.height / Math.max(image.width, 1))),
  );
  const width = contentW + side * 2;
  const height =
    side * 2 +
    header +
    footer +
    photoHeights.reduce((sum, value) => sum + value, 0) +
    gap * Math.max(images.length - 1, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nincs canvas");

  paintFrame(ctx, width, height, settings.frameStyle);

  ctx.textAlign = "center";
  let titleY = side + 78;
  if (logo) {
    const maxH = 96;
    const maxW = 360;
    const scale = Math.min(maxH / logo.height, maxW / logo.width, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, (width - w) / 2, side + 20, w, h);
    titleY = side + 20 + h + 48;
    logo.close();
  }

  ctx.fillStyle = settings.frameStyle === "classic" ? "#1a1714" : "#e8d5a3";
  ctx.font = "600 52px 'Playfair Display', serif";
  ctx.fillText(settings.name || "PHOTO BOOTH", width / 2, titleY, contentW);

  ctx.fillStyle = settings.frameStyle === "classic" ? "#6b6258" : "rgba(255,255,255,0.45)";
  ctx.font = "500 22px Inter, sans-serif";
  ctx.fillText(
    shots.length > 1 ? `${shots.length} FOTÓ` : "FOTÓ",
    width / 2,
    titleY + 40,
  );

  let y = side + header;
  for (let i = 0; i < images.length; i += 1) {
    ctx.drawImage(images[i], side, y, contentW, photoHeights[i]);
    y += photoHeights[i] + gap;
    images[i].close();
  }

  if (settings.eventCaption.trim()) {
    ctx.fillStyle = settings.frameStyle === "classic" ? "#3f3a34" : "#f3e6c4";
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillText(settings.eventCaption.trim(), width / 2, height - side - 36, contentW);
  }

  return canvasBlob(canvas, settings.jpegQuality);
}
