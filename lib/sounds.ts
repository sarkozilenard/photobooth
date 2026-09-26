let audioCtx: AudioContext | null = null;

function ctx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

export async function resumeAudio() {
  const context = ctx();
  if (context?.state === "suspended") await context.resume();
}

function beep(frequency: number, duration = 0.12, gain = 0.08) {
  const context = ctx();
  if (!context) return;
  const osc = context.createOscillator();
  const amp = context.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(context.destination);
  osc.start();
  amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  osc.stop(context.currentTime + duration);
}

export function playCountdownBeep(n: number) {
  const map: Record<number, number> = { 3: 660, 2: 720, 1: 880 };
  beep(map[n] ?? 700);
}

export function playShutter() {
  const context = ctx();
  if (!context) return;
  const length = 0.16;
  const buffer = context.createBuffer(1, context.sampleRate * length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 18) * (t < 0.04 ? 1 : 0.35);
  }
  const src = context.createBufferSource();
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1200;
  const amp = context.createGain();
  amp.gain.value = 0.22;
  src.buffer = buffer;
  src.connect(filter);
  filter.connect(amp);
  amp.connect(context.destination);
  src.start();
}
