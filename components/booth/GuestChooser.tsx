"use client";

import { LayoutMock } from "@/components/booth/LayoutMock";
import { KioskChip, KioskLabel } from "@/components/ui/KioskChip";
import {
  ASPECTS,
  AspectPreset,
  COUNTDOWNS,
  EXPERIENCES,
  ExperiencePreset,
  FRAMES,
  FramePreset,
  LAYOUTS,
  canUseGrid,
} from "@/lib/booth/guest-presets";
import { FrameStyle, LayoutStyle } from "@/lib/types";

export function GuestChooser({
  photos,
  layout,
  frame,
  countdown,
  aspectId,
  aspectRatio,
  poster,
  onExperience,
  onLayout,
  onFrame,
  onCountdown,
  onAspect,
}: {
  photos: number;
  layout: LayoutStyle;
  frame: FrameStyle;
  countdown: number;
  aspectId: string;
  aspectRatio: number | null;
  poster?: string;
  dense?: boolean;
  onExperience: (preset: ExperiencePreset) => void;
  onLayout: (layout: LayoutStyle) => void;
  onFrame: (preset: FramePreset) => void;
  onCountdown: (seconds: number) => void;
  onAspect: (preset: AspectPreset) => void;
}) {
  const layouts = LAYOUTS.filter(
    (preset) => preset.id === "strip" || canUseGrid(photos),
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="flex flex-col gap-2">
        <KioskLabel>Fotók</KioskLabel>
        <div className="flex flex-wrap justify-center gap-2">
          {EXPERIENCES.map((preset) => (
            <KioskChip
              key={preset.id}
              selected={preset.photos === photos}
              onClick={() => onExperience(preset)}
            >
              {preset.label}
            </KioskChip>
          ))}
        </div>
      </section>
      {photos > 1 ? (
        <section className="flex flex-col gap-2">
          <KioskLabel>Elrendezés</KioskLabel>
          <div className="flex justify-center gap-4">
            {layouts.map((preset) => (
              <LayoutMock
                key={preset.id}
                photos={photos}
                layout={preset.id}
                frame={frame}
                poster={poster}
                aspectRatio={aspectRatio}
                active={preset.id === layout}
                onClick={() => onLayout(preset.id)}
                label={preset.label}
              />
            ))}
          </div>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <KioskLabel>Keret</KioskLabel>
        <div className="flex flex-wrap justify-center gap-2">
          {FRAMES.map((preset) => (
            <KioskChip
              key={preset.id}
              selected={preset.id === frame}
              onClick={() => onFrame(preset)}
            >
              {preset.label}
            </KioskChip>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <KioskLabel>Kivágás</KioskLabel>
        <div className="flex flex-wrap justify-center gap-2">
          {ASPECTS.map((preset) => (
            <KioskChip
              key={preset.id}
              selected={preset.id === aspectId}
              onClick={() => onAspect(preset)}
            >
              {preset.label}
            </KioskChip>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <KioskLabel>Visszaszámláló</KioskLabel>
        <div className="flex flex-wrap justify-center gap-2">
          {COUNTDOWNS.map((seconds) => (
            <KioskChip
              key={seconds}
              selected={countdown === seconds}
              onClick={() => onCountdown(seconds)}
            >
              {seconds} mp
            </KioskChip>
          ))}
        </div>
      </section>
    </div>
  );
}
