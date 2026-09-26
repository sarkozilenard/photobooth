import { BoothLook } from "@/lib/effects/looks";

export function LookOverlay({ look }: { look: BoothLook }) {
  if (look.overlay === "none") return null;
  if (look.overlay === "scanlines") {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-40 mix-blend-multiply"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 4px)",
        }}
      />
    );
  }
  if (look.overlay === "gold") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_42%,rgba(80,48,8,0.45)_100%)]" />
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
  );
}
