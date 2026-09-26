export function countdownEndsAt(seconds: number) {
  return Date.now() + Math.min(20, Math.max(1, seconds)) * 1000;
}

export function runSyncedCountdown(
  endsAt: number,
  onTick: (n: number | null) => void,
  onBeep?: (n: number) => void,
) {
  return new Promise<void>((resolve) => {
    let last: number | null = null;
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      onTick(null);
      resolve();
    };
    const tick = () => {
      const left = endsAt - Date.now();
      if (left <= 0) {
        finish();
        return;
      }
      const n = Math.max(1, Math.ceil(left / 1000));
      if (n !== last) {
        last = n;
        onTick(n);
        onBeep?.(n);
      }
      timer = window.setTimeout(tick, Math.min(80, left));
    };
    tick();
  });
}
