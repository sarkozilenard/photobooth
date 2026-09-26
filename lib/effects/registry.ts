export type EffectId = string;

export interface EffectPlugin {
  id: EffectId;
  label: string;
  ready: boolean;
}

export { BOOTH_LOOKS as effectRegistry } from "@/lib/effects/looks";
