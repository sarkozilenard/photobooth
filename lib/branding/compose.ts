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

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = image.width / Math.max(image.height, 1);
  const r = w / Math.max(h, 1);
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (ir > r) {
    sw = image.height * r;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / r;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
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
    ctx.fillRect(14, 14, width - 28, height - 28);
    ctx.strokeStyle = "#e8d5a3";
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, width - 52, height - 52);
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

function isBoothStrip(style: FrameStyle) {
  return style === "booth" || style === "classic";
}

export async function composeSession(
  shots: Blob[],
  settings: BoothSettings,
  logo?: ImageBitmap | null,
) {
  const images = await Promise.all(shots.map(blobToImage));
  const style = settings.frameStyle;
  const caption = settings.eventCaption.trim();

  if (style === "none") {
    const contentW = 900;
    const gap = 8;
    const heights = images.map((image) =>
      Math.round(contentW * (image.height / Math.max(image.width, 1))),
    );
    const width = contentW;
    const height =
      heights.reduce((sum, value) => sum + value, 0) + gap * Math.max(images.length - 1, 0);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Nincs canvas");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    let y = 0;
    for (let i = 0; i < images.length; i += 1) {
      ctx.drawImage(images[i], 0, y, contentW, heights[i]);
      y += heights[i] + gap;
      images[i].close();
    }
    logo?.close();
    return canvasBlob(canvas, Math.min(settings.jpegQuality, 0.88));
  }

  if (isBoothStrip(style)) {
    const photoW = 620;
    const photoH = 620;
    const side = 28;
    const gap = 22;
    const footer = caption || logo ? 88 : 36;
    const width = photoW + side * 2;
    const height = side + images.length * photoH + (images.length - 1) * gap + footer;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Nincs canvas");
    paintFrame(ctx, width, height, "booth");
    let y = side;
    for (let i = 0; i < images.length; i += 1) {
      drawCover(ctx, images[i], side, y, photoW, photoH);
      y += photoH + gap;
      images[i].close();
    }
    ctx.fillStyle = "#3f3a34";
    ctx.textAlign = "center";
    if (logo) {
      const maxH = 36;
      const maxW = 220;
      const scale = Math.min(maxH / logo.height, maxW / logo.width, 1);
      const w = logo.width * scale;
      const h = logo.height * scale;
      ctx.drawImage(logo, (width - w) / 2, height - footer + 12, w, h);
      logo.close();
    } else if (caption) {
      ctx.font = "500 22px 'Playfair Display', serif";
      ctx.fillText(caption, width / 2, height - 28, photoW);
    }
    return canvasBlob(canvas, Math.min(settings.jpegQuality, 0.88));
  }

  const contentW = 900;
  const gap = 18;
  const header = logo ? 200 : 132;
  const footer = caption ? 96 : 68;
  const side = 52;
  const grid = (settings.layoutStyle ?? "strip") === "grid" && images.length > 1;
  const cols = 2;
  const cellW = grid ? Math.round((contentW - gap) / 2) : contentW;
  const photoHeights = images.map((image) =>
    Math.round((grid ? cellW : contentW) * (image.height / Math.max(image.width, 1))),
  );
  const fullH = (image: ImageBitmap) =>
    Math.round(contentW * (image.height / Math.max(image.width, 1)));
  const rowH = (start: number, count: number) =>
    Math.max(...photoHeights.slice(start, start + count), 0);
  let photosBlock = 0;
  if (grid) {
    if (images.length === 3) {
      photosBlock = rowH(0, 2) + gap + fullH(images[2]);
    } else {
      const rows = Math.ceil(images.length / cols);
      for (let r = 0; r < rows; r += 1) {
        photosBlock += rowH(r * cols, cols);
        if (r < rows - 1) photosBlock += gap;
      }
    }
  } else {
    photosBlock =
      photoHeights.reduce((sum, value) => sum + value, 0) +
      gap * Math.max(images.length - 1, 0);
  }
  const width = contentW + side * 2;
  const height = side * 2 + header + footer + photosBlock;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nincs canvas");
  paintFrame(ctx, width, height, style);

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

  ctx.fillStyle = "#e8d5a3";
  ctx.font = "600 52px 'Playfair Display', serif";
  ctx.fillText(settings.name || "PHOTO BOOTH", width / 2, titleY, contentW);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 22px Inter, sans-serif";
  ctx.fillText(
    shots.length > 1 ? `${shots.length} FOTÓ` : "FOTÓ",
    width / 2,
    titleY + 40,
  );

  let y = side + header;
  if (grid) {
    if (images.length === 3) {
      const h0 = rowH(0, 2);
      ctx.drawImage(images[0], side, y, cellW, photoHeights[0]);
      ctx.drawImage(images[1], side + cellW + gap, y, cellW, photoHeights[1]);
      y += h0 + gap;
      ctx.drawImage(images[2], side, y, contentW, fullH(images[2]));
    } else {
      for (let i = 0; i < images.length; i += 1) {
        const col = i % cols;
        if (col === 0 && i > 0) y += rowH(i - cols, cols) + gap;
        ctx.drawImage(images[i], side + col * (cellW + gap), y, cellW, photoHeights[i]);
      }
    }
    images.forEach((image) => image.close());
  } else {
    for (let i = 0; i < images.length; i += 1) {
      ctx.drawImage(images[i], side, y, contentW, photoHeights[i]);
      y += photoHeights[i] + gap;
      images[i].close();
    }
  }

  if (caption) {
    ctx.fillStyle = "#f3e6c4";
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillText(caption, width / 2, height - side - 36, contentW);
  }

  return canvasBlob(canvas, Math.min(settings.jpegQuality, 0.84));
}
