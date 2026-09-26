import { FrameStyle } from "@/lib/types";

export type LookOverlay = "none" | "vignette" | "scanlines" | "gold";

export interface BoothLook {
  id: string;
  label: string;
  hint: string;
  filter: string;
  overlay: LookOverlay;
  frameStyle?: FrameStyle;
}

export const BOOTH_LOOKS: BoothLook[] = [
  {
    id: "original",
    label: "Eredeti",
    hint: "Tiszta kép",
    filter: "none",
    overlay: "none",
    frameStyle: "gold",
  },
  {
    id: "noir",
    label: "Noir",
    hint: "Fekete-fehér",
    filter: "grayscale(1) contrast(1.18) brightness(1.02)",
    overlay: "vignette",
    frameStyle: "minimal",
  },
  {
    id: "vintage",
    label: "Vintage",
    hint: "Film",
    filter: "sepia(0.42) contrast(1.08) saturate(0.82) brightness(1.04)",
    overlay: "vignette",
    frameStyle: "classic",
  },
  {
    id: "gold",
    label: "Arany",
    hint: "Meleg",
    filter: "sepia(0.22) saturate(1.25) contrast(1.06) hue-rotate(-12deg)",
    overlay: "gold",
    frameStyle: "gold",
  },
  {
    id: "pop",
    label: "Pop",
    hint: "Kontraszt",
    filter: "contrast(1.28) saturate(1.45) brightness(1.04)",
    overlay: "none",
    frameStyle: "minimal",
  },
  {
    id: "cool",
    label: "Cool",
    hint: "Kék",
    filter: "saturate(0.88) hue-rotate(18deg) contrast(1.08) brightness(1.06)",
    overlay: "none",
    frameStyle: "none",
  },
  {
    id: "glam",
    label: "Glam",
    hint: "Puha",
    filter: "brightness(1.12) contrast(0.92) saturate(0.95) blur(0.35px)",
    overlay: "gold",
    frameStyle: "gold",
  },
  {
    id: "neon",
    label: "Neon",
    hint: "Parti",
    filter: "saturate(1.7) contrast(1.22) hue-rotate(-18deg) brightness(1.05)",
    overlay: "scanlines",
    frameStyle: "minimal",
  },
  {
    id: "xray",
    label: "Röntgen",
    hint: "Fun",
    filter: "invert(1) hue-rotate(180deg) contrast(1.15)",
    overlay: "none",
    frameStyle: "none",
  },
];

export const DEFAULT_LOOK = BOOTH_LOOKS[0];

export function getLook(id: string | undefined) {
  return BOOTH_LOOKS.find((look) => look.id === id) ?? DEFAULT_LOOK;
}

export function paintLookOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: LookOverlay,
) {
  if (overlay === "none") return;
  if (overlay === "vignette" || overlay === "gold") {
    const glow = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.22,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    glow.addColorStop(0, "rgba(0,0,0,0)");
    glow.addColorStop(
      1,
      overlay === "gold" ? "rgba(70, 42, 8, 0.38)" : "rgba(0,0,0,0.5)",
    );
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  const step = Math.max(4, Math.round(height / 90));
  for (let y = 0; y < height; y += step) {
    ctx.fillRect(0, y, width, 1);
  }
}
