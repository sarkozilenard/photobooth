import { FrameStyle, LayoutStyle } from "@/lib/types";

export interface ExperiencePreset {
  id: string;
  label: string;
  hint: string;
  photos: number;
  layout: LayoutStyle;
}

export const EXPERIENCES: ExperiencePreset[] = [
  { id: "solo", label: "1 fotó", hint: "Egy portré", photos: 1, layout: "strip" },
  { id: "strip3", label: "3 fotó", hint: "Klasszikus booth", photos: 3, layout: "strip" },
  { id: "strip4", label: "4 fotó", hint: "Hosszú csík", photos: 4, layout: "strip" },
];

export interface FramePreset {
  id: FrameStyle;
  label: string;
  hint: string;
}

export const FRAMES: FramePreset[] = [
  { id: "booth", label: "Booth csík", hint: "Fehér automata" },
  { id: "none", label: "Nincs keret", hint: "Csak a fotó" },
  { id: "gold", label: "Arany", hint: "Gála" },
  { id: "minimal", label: "Minimal", hint: "Fekete" },
];

export const COUNTDOWNS = [3, 5, 10, 20] as const;

export interface AspectPreset {
  id: string;
  label: string;
  ratio: number | null;
}

export const ASPECTS: AspectPreset[] = [
  { id: "native", label: "Eredeti", ratio: null },
  { id: "1-1", label: "1:1", ratio: 1 },
  { id: "4-5", label: "4:5", ratio: 4 / 5 },
  { id: "3-2", label: "3:2", ratio: 3 / 2 },
  { id: "16-9", label: "16:9", ratio: 16 / 9 },
  { id: "9-16", label: "9:16", ratio: 9 / 16 },
];

export const LAYOUTS: { id: LayoutStyle; label: string }[] = [
  { id: "strip", label: "Csík" },
  { id: "grid", label: "Rács" },
];

export function matchExperience(photos: number, layout: LayoutStyle) {
  return (
    EXPERIENCES.find((item) => item.photos === photos && item.layout === layout) ??
    EXPERIENCES.find((item) => item.photos === photos) ??
    EXPERIENCES[1]
  );
}
