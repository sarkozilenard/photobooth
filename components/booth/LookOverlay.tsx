import { BoothLook } from "@/lib/effects/looks";

export function LookOverlay({ look }: { look: BoothLook }) {
  if (look.overlay === "none") return null;
  if (look.overlay === "grain" || look.overlay === "paper") {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1] mix-blend-overlay"
        style={{
          opacity: look.overlay === "paper" ? 0.35 : 0.28,
          backgroundImage:
            look.overlay === "paper"
              ? "radial-gradient(circle at center, rgba(214,186,140,0.35), transparent 70%), repeating-radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0 1px, transparent 1px 3px)"
              : "repeating-radial-gradient(circle at 15% 20%, rgba(255,255,255,0.18) 0 1px, transparent 1px 3px)",
        }}
      />
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
  );
}
