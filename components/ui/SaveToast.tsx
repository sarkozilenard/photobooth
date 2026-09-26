"use client";

export function SaveToast({
  show,
  title,
  detail,
}: {
  show: boolean;
  title: string;
  detail?: string;
}) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[90] flex justify-center px-4"
    >
      <div className="flex w-full max-w-md items-center gap-4 rounded-[1.75rem] border border-emerald-300/45 bg-emerald-950/95 px-5 py-4 text-white shadow-[0_24px_60px_rgba(16,185,129,0.35)] backdrop-blur-md motion-safe:animate-[savepop_220ms_ease-out]">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M5 12.5 10 17.5 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-[0.14em] uppercase">{title}</p>
          {detail ? (
            <p className="mt-1 text-sm leading-snug text-emerald-50/80">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
