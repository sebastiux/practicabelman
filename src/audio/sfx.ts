/* Efectos sintetizados con Web Audio: power chords distorsionados, sin archivos de audio. */

const KEY = "seek-and-bellman:muted";
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* sin almacenamiento: sólo dura la sesión */
  }
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function distortionCurve(amount: number) {
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / curve.length - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

interface ChordOptions {
  gain?: number;
  cutoff?: number;
  drive?: number;
}

function chord(freqs: number[], start: number, duration: number, { gain = 0.16, cutoff = 2400, drive = 60 }: ChordOptions = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const shaper = a.createWaveShaper();
  shaper.curve = distortionCurve(drive);
  shaper.oversample = "4x";
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const amp = a.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  shaper.connect(filter).connect(amp).connect(a.destination);
  for (const f of freqs) {
    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * 10;
    osc.connect(shaper);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }
}

function kick(start = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.25);
  amp.gain.setValueAtTime(0.5, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  osc.connect(amp).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.32);
}

function hat(start = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const buffer = a.createBuffer(1, a.sampleRate * 0.05, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const amp = a.createGain();
  amp.gain.setValueAtTime(0.12, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
  src.connect(hp).connect(amp).connect(a.destination);
  src.start(t0);
}

// Frecuencias (Hz) de las notas usadas.
const E2 = 82.41, G2 = 98.0, A2 = 110.0, Bb2 = 116.54, B2 = 123.47, D3 = 146.83, E3 = 164.81, G3 = 196.0, A3 = 220.0;

export const sfx = {
  /** Paso: palm mute en Mi grave. */
  step: () => chord([E2, B2], 0, 0.12, { gain: 0.11, cutoff: 650 }),
  /** Choque con la frontera: bombo. */
  bump: () => kick(),
  /** Muerte: el tritono (diabolus in musica), cayendo. */
  death: () => {
    chord([E2, Bb2], 0, 0.45, { gain: 0.16 });
    chord([E2 * 0.94, Bb2 * 0.94], 0.3, 1.1, { gain: 0.14, cutoff: 1400 });
    kick(0);
    kick(0.3);
  },
  /** Victoria: E5 – G5 – A5. */
  win: () => {
    chord([E2, B2, E3], 0, 0.3);
    chord([G2, D3, G3], 0.3, 0.3);
    chord([A2, E3, A3], 0.6, 1.4);
    kick(0);
    kick(0.3);
    kick(0.6);
  },
  /** Un barrido de Bellman: hi-hat. */
  tick: () => hat(),
};
