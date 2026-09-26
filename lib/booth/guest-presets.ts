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
  { id: "strip3", label: "3-as csík", hint: "Klasszikus booth", photos: 3, layout: "strip" },
  { id: "strip4", label: "4-es csík", hint: "Hosszú strip", photos: 4, layout: "strip" },
  { id: "grid4", label: "4-es rács", hint: "Kollázs", photos: 4, layout: "grid" },
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

export const COUNTDOWNS = [3, 5, 8, 10] as const;

export function matchExperience(photos: number, layout: LayoutStyle) {
  return (
    EXPERIENCES.find((item) => item.photos === photos && item.layout === layout) ??
    EXPERIENCES.find((item) => item.photos === photos) ??
    EXPERIENCES[1]
  );
}
