"use client";

import {
  COUNTDOWNS,
  EXPERIENCES,
  ExperiencePreset,
  FRAMES,
  FramePreset,
} from "@/lib/booth/guest-presets";
import { FrameStyle, LayoutStyle } from "@/lib/types";

function ring(selected: boolean) {
  return selected
    ? "ring-2 ring-[#c4a35a] ring-offset-2 ring-offset-black"
    : "ring-1 ring-white/15";
}

function ExperienceArt({ preset }: { preset: ExperiencePreset }) {
  if (preset.layout === "grid") {
    return (
      <div className="grid h-16 w-16 grid-cols-2 gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[3px] bg-white/35" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-16 w-10 flex-col gap-0.5">
      {Array.from({ length: preset.photos }).map((_, i) => (
        <div key={i} className="min-h-0 flex-1 rounded-[2px] bg-white/35" />
      ))}
    </div>
  );
}

function FrameArt({ frame }: { frame: FramePreset }) {
  const box =
    frame.id === "gold"
      ? "bg-[#c4a35a] p-1"
      : frame.id === "classic"
        ? "bg-[#f4efe4] p-1.5"
        : frame.id === "minimal"
          ? "border-2 border-white bg-black p-1"
          : "bg-white/10 p-0";
  return (
    <div className={`h-16 w-12 ${box}`}>
      <div className="h-full w-full bg-white/25" />
    </div>
  );
}

export function GuestChooser({
  photos,
  layout,
  frame,
  countdown,
  sounds,
  flash,
  onExperience,
  onFrame,
  onCountdown,
  onSounds,
  onFlash,
}: {
  photos: number;
  layout: LayoutStyle;
  frame: FrameStyle;
  countdown: number;
  sounds: boolean;
  flash: boolean;
  onExperience: (preset: ExperiencePreset) => void;
  onFrame: (preset: FramePreset) => void;
  onCountdown: (seconds: number) => void;
  onSounds: (value: boolean) => void;
  onFlash: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="mb-2 text-[11px] tracking-[0.28em] text-[#c4a35a] uppercase">
          Élmény
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCES.map((preset) => {
            const selected = preset.photos === photos && preset.layout === layout;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onExperience(preset)}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-black/45 px-2 py-3 text-center ${ring(selected)}`}
                aria-pressed={selected}
              >
                <ExperienceArt preset={preset} />
                <span className="text-xs font-semibold tracking-[0.12em] uppercase">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] tracking-[0.28em] text-[#c4a35a] uppercase">
          Sablon
        </p>
        <div className="grid grid-cols-4 gap-2">
          {FRAMES.map((preset) => {
            const selected = preset.id === frame;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onFrame(preset)}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-black/45 px-1 py-2 ${ring(selected)}`}
                aria-pressed={selected}
              >
                <FrameArt frame={preset} />
                <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <p className="w-full text-[11px] tracking-[0.28em] text-[#c4a35a] uppercase">
          Időzítő · extra
        </p>
        {COUNTDOWNS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onCountdown(seconds)}
            className={`min-h-14 min-w-14 rounded-full text-lg font-semibold ${
              countdown === seconds ? "bg-[#c4a35a] text-black" : "bg-white/10"
            }`}
            aria-pressed={countdown === seconds}
          >
            {seconds}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSounds(!sounds)}
          className={`min-h-14 rounded-full px-5 text-sm tracking-[0.14em] uppercase ${
            sounds ? "bg-white text-black" : "bg-white/10"
          }`}
          aria-pressed={sounds}
        >
          Hang
        </button>
        <button
          type="button"
          onClick={() => onFlash(!flash)}
          className={`min-h-14 rounded-full px-5 text-sm tracking-[0.14em] uppercase ${
            flash ? "bg-white text-black" : "bg-white/10"
          }`}
          aria-pressed={flash}
        >
          Flash
        </button>
      </section>
    </div>
  );
}
