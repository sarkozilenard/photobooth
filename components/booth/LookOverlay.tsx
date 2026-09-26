import { BoothLook } from "@/lib/effects/looks";

export function LookOverlay({ look }: { look: BoothLook }) {
  if (look.overlay === "none") return null;
  if (look.overlay === "grain" || look.overlay === "paper" || look.overlay === "film") {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1] mix-blend-overlay"
        style={{
          opacity: look.overlay === "paper" ? 0.35 : look.overlay === "film" ? 0.42 : 0.28,
          backgroundImage:
            look.overlay === "paper"
              ? "radial-gradient(circle at center, rgba(214,186,140,0.35), transparent 70%), repeating-radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0 1px, transparent 1px 3px)"
              : look.overlay === "film"
                ? "radial-gradient(circle at center, transparent 42%, rgba(12,10,16,0.55) 100%), linear-gradient(180deg, rgba(90,110,140,0.28), rgba(36,42,58,0.32)), repeating-radial-gradient(circle at 18% 22%, rgba(255,255,255,0.22) 0 1px, transparent 1px 2px)"
                : "repeating-radial-gradient(circle at 15% 20%, rgba(255,255,255,0.18) 0 1px, transparent 1px 3px)",
        }}
      />
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
  );
}
