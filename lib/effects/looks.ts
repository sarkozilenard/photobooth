import { FrameStyle } from "@/lib/types";

export type LookOverlay = "none" | "vignette" | "grain" | "paper";

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
