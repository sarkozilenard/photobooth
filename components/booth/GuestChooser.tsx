"use client";

import { LayoutMock } from "@/components/booth/LayoutMock";
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

function chip(on: boolean) {
  return on
    ? "bg-white text-black"
    : "bg-white/10 text-white ring-1 ring-white/20";
}

export function GuestChooser({
  photos,
  layout,
  frame,
  countdown,
  aspectId,
  aspectRatio,
  poster,
  dense = false,
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
    <div className={`flex w-full flex-col ${dense ? "gap-1.5" : "gap-2"}`}>
      <div className="flex flex-wrap justify-center gap-1.5">
        {EXPERIENCES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onExperience(preset)}
            className={`min-h-10 rounded-full px-3 text-xs font-semibold ${chip(preset.photos === photos)}`}
            aria-pressed={preset.photos === photos}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {photos > 1 ? (
        <div className="flex justify-center gap-3 py-1">
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
      ) : null}
      <div className="flex flex-wrap justify-center gap-1.5">
        {FRAMES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onFrame(preset)}
            className={`min-h-10 rounded-full px-3 text-xs font-semibold ${chip(preset.id === frame)}`}
            aria-pressed={preset.id === frame}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {ASPECTS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onAspect(preset)}
            className={`min-h-10 rounded-full px-3 text-xs font-semibold ${chip(preset.id === aspectId)}`}
            aria-pressed={preset.id === aspectId}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {COUNTDOWNS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onCountdown(seconds)}
            className={`min-h-10 min-w-12 rounded-full text-xs font-semibold ${chip(countdown === seconds)}`}
            aria-pressed={countdown === seconds}
          >
            {seconds} mp
          </button>
        ))}
      </div>
    </div>
  );
}
