export type LookOverlay = "none" | "vignette" | "grain" | "paper" | "film";

export interface BoothLook {
  id: string;
  label: string;
  hint: string;
  filter: string;
  overlay: LookOverlay;
}

export const BOOTH_LOOKS: BoothLook[] = [
  {
    id: "booth",
    label: "Booth",
    hint: "Klasszikus automata",
    filter: "grayscale(1) contrast(1.42) brightness(1.06) saturate(0)",
    overlay: "grain",
  },
  {
    id: "film",
    label: "Film",
    hint: "Vintage booth",
    filter: "contrast(0.9) brightness(1.08) saturate(0.52) sepia(0.18) hue-rotate(188deg)",
    overlay: "film",
  },
  {
    id: "sepia",
    label: "Sepia",
    hint: "Meleg film",
    filter: "sepia(0.7) contrast(1.28) brightness(1.08) saturate(0.55)",
    overlay: "paper",
  },
  {
    id: "softbw",
    label: "Portré",
    hint: "Puha fekete-fehér",
    filter: "grayscale(1) contrast(1.12) brightness(1.1)",
    overlay: "vignette",
  },
  {
    id: "original",
    label: "Színes",
    hint: "Tiszta kép",
    filter: "none",
    overlay: "none",
  },
  {
    id: "pop",
    label: "Pop",
    hint: "Kontraszt",
    filter: "contrast(1.28) saturate(1.4) brightness(1.04)",
    overlay: "none",
  },
  {
    id: "cool",
    label: "Cool",
    hint: "Kék",
    filter: "saturate(0.88) hue-rotate(16deg) contrast(1.08) brightness(1.05)",
    overlay: "none",
  },
  {
    id: "glam",
    label: "Glam",
    hint: "Puha",
    filter: "brightness(1.12) contrast(0.92) saturate(0.95)",
    overlay: "vignette",
  },
  {
    id: "neon",
    label: "Neon",
    hint: "Parti",
    filter: "saturate(1.65) contrast(1.2) hue-rotate(-16deg)",
    overlay: "none",
  },
  {
    id: "xray",
    label: "Röntgen",
    hint: "Fun",
    filter: "invert(1) hue-rotate(180deg) contrast(1.15)",
    overlay: "none",
  },
];

export const DEFAULT_LOOK = BOOTH_LOOKS[0];

export function getLook(id: string | undefined) {
  return BOOTH_LOOKS.find((look) => look.id === id) ?? DEFAULT_LOOK;
}

function paintGrain(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number) {
  const tile = 96;
  const noise = document.createElement("canvas");
  noise.width = tile;
  noise.height = tile;
  const nctx = noise.getContext("2d");
  if (!nctx) return;
  const data = nctx.createImageData(tile, tile);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 80 + Math.random() * 100;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = Math.round(alpha * 255);
  }
  nctx.putImageData(data, 0, 0);
  const pattern = ctx.createPattern(noise, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function paintLookOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: LookOverlay,
) {
  if (overlay === "none") return;
  if (overlay === "grain") {
    paintGrain(ctx, width, height, 0.18);
    const glow = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7,
    );
    glow.addColorStop(0, "rgba(0,0,0,0)");
    glow.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (overlay === "paper") {
    paintGrain(ctx, width, height, 0.12);
    ctx.fillStyle = "rgba(214, 186, 140, 0.14)";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (overlay === "film") {
    paintGrain(ctx, width, height, 0.28);
    ctx.fillStyle = "rgba(72, 92, 122, 0.16)";
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.28,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    glow.addColorStop(0, "rgba(0,0,0,0)");
    glow.addColorStop(1, "rgba(18, 16, 22, 0.38)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applyTone(r: number, g: number, b: number, contrast: number, brightness: number) {
  const c = contrast;
  const br = brightness;
  return {
    r: clamp(((r / 255 - 0.5) * c + 0.5) * br * 255),
    g: clamp(((g / 255 - 0.5) * c + 0.5) * br * 255),
    b: clamp(((b / 255 - 0.5) * c + 0.5) * br * 255),
  };
}

export function bakeLook(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: BoothLook,
) {
  if (look.id === "original") {
    paintLookOverlay(ctx, width, height, look.overlay);
    return;
  }
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    if (look.id === "booth" || look.id === "softbw") {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = g = b = y;
      const tone = applyTone(r, g, b, look.id === "booth" ? 1.42 : 1.12, look.id === "booth" ? 1.06 : 1.1);
      r = tone.r;
      g = tone.g;
      b = tone.b;
    } else if (look.id === "film") {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = r * 0.58 + y * 0.42;
      g = g * 0.58 + y * 0.42;
      b = b * 0.58 + y * 0.42;
      r = r * 0.84 + 36;
      g = g * 0.84 + 40;
      b = b * 0.84 + 52;
      const t = y / 255;
      r = clamp(r + (t - 0.42) * 14);
      g = clamp(g + (t - 0.5) * 4);
      b = clamp(b + (0.52 - t) * 22);
      const tone = applyTone(r, g, b, 0.9, 1.05);
      r = tone.r;
      g = tone.g;
      b = tone.b;
    } else if (look.id === "sepia") {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = y;
      g = y;
      b = y;
      const tone = applyTone(r, g, b, 1.28, 1.08);
      r = clamp(tone.r * 1.15);
      g = clamp(tone.g * 1.02);
      b = clamp(tone.b * 0.72);
    } else if (look.id === "pop") {
      const tone = applyTone(r, g, b, 1.28, 1.04);
      r = clamp(tone.r * 1.12);
      g = clamp(tone.g * 1.08);
      b = clamp(tone.b * 1.04);
    } else if (look.id === "cool") {
      const tone = applyTone(r, g, b, 1.08, 1.05);
      r = clamp(tone.r * 0.9);
      g = clamp(tone.g * 0.98);
      b = clamp(tone.b * 1.12);
    } else if (look.id === "glam") {
      const tone = applyTone(r, g, b, 0.92, 1.12);
      r = tone.r;
      g = tone.g;
      b = tone.b;
    } else if (look.id === "neon") {
      const tone = applyTone(r, g, b, 1.2, 1);
      r = clamp(tone.r * 1.15);
      g = clamp(tone.g * 0.9);
      b = clamp(tone.b * 1.2);
    } else if (look.id === "xray") {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
      const tone = applyTone(r, g, b, 1.15, 1);
      r = tone.b;
      g = tone.g;
      b = tone.r;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  paintLookOverlay(ctx, width, height, look.overlay);
}
