let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
}

function tone(freq: number, duration: number, delay = 0, type: OscillatorType = 'sine', gainValue = 0.08): void {
  if (muted) return;
  const audio = getCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain).connect(audio.destination);
  const start = audio.currentTime + delay;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playAccept(): void {
  tone(523.25, 0.14);
  tone(659.25, 0.16, 0.1);
  tone(783.99, 0.22, 0.2);
}

export function playReject(): void {
  tone(220, 0.18, 0, 'sawtooth', 0.05);
  tone(180, 0.22, 0.12, 'sawtooth', 0.05);
}

export function playBuild(): void {
  tone(392, 0.1, 0, 'square', 0.045);
  tone(523.25, 0.14, 0.1, 'square', 0.045);
}

export function playCash(): void {
  tone(880, 0.08, 0, 'triangle', 0.06);
  tone(1046.5, 0.1, 0.08, 'triangle', 0.06);
  tone(1318.5, 0.16, 0.16, 'triangle', 0.06);
}

export function playClick(): void {
  tone(660, 0.05, 0, 'sine', 0.04);
}
