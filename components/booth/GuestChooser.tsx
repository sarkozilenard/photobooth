"use client";

import {
  ASPECTS,
  AspectPreset,
  COUNTDOWNS,
  EXPERIENCES,
  ExperiencePreset,
  FRAMES,
  FramePreset,
  LAYOUTS,
} from "@/lib/booth/guest-presets";
import { FrameStyle, LayoutStyle } from "@/lib/types";

function chip(on: boolean) {
  return on
    ? "bg-white text-black"
    : "bg-black/45 text-white ring-1 ring-white/20";
}

export function GuestChooser({
  photos,
  layout,
  frame,
  countdown,
  aspectId,
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
  sounds?: boolean;
  flash?: boolean;
  onExperience: (preset: ExperiencePreset) => void;
  onLayout: (layout: LayoutStyle) => void;
  onFrame: (preset: FramePreset) => void;
  onCountdown: (seconds: number) => void;
  onAspect: (preset: AspectPreset) => void;
  onSounds?: (value: boolean) => void;
  onFlash?: (value: boolean) => void;
}) {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {EXPERIENCES.map((preset) => {
          const on = preset.photos === photos;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onExperience(preset)}
              className={`min-h-12 rounded-full px-5 text-sm font-semibold ${chip(on)}`}
              aria-pressed={on}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {photos > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {LAYOUTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onLayout(preset.id)}
              className={`min-h-12 rounded-full px-5 text-sm font-semibold ${chip(preset.id === layout)}`}
              aria-pressed={preset.id === layout}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        {FRAMES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onFrame(preset)}
            className={`min-h-12 rounded-full px-5 text-sm font-semibold ${chip(preset.id === frame)}`}
            aria-pressed={preset.id === frame}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {ASPECTS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onAspect(preset)}
            className={`min-h-12 rounded-full px-4 text-sm font-semibold ${chip(preset.id === aspectId)}`}
            aria-pressed={preset.id === aspectId}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {COUNTDOWNS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onCountdown(seconds)}
            className={`min-h-12 min-w-14 rounded-full text-sm font-semibold ${chip(countdown === seconds)}`}
            aria-pressed={countdown === seconds}
          >
            {seconds} mp
          </button>
        ))}
        <input
          type="range"
          min={1}
          max={20}
          value={countdown}
          className="h-10 w-40 accent-[#c4a35a] sm:w-56"
          aria-label="Időzítő"
          onChange={(e) => onCountdown(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
