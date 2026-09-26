export type EffectId =
  | "none"
  | "frame"
  | "watermark"
  | "collage"
  | "gif"
  | "boomerang"
  | "background-replace"
  | "social-crop";

export interface EffectPlugin {
  id: EffectId;
  label: string;
  ready: boolean;
}

export const effectRegistry: EffectPlugin[] = [
  { id: "none", label: "Alap fotó", ready: true },
  { id: "frame", label: "Fotókeret", ready: true },
  { id: "watermark", label: "Logó / vízjel", ready: true },
  { id: "collage", label: "Kollázs", ready: true },
  { id: "gif", label: "GIF", ready: false },
  { id: "boomerang", label: "Boomerang", ready: false },
  { id: "background-replace", label: "Háttércsere", ready: false },
  { id: "social-crop", label: "Instagram / TikTok vágás", ready: false },
];
