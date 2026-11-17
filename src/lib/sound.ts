// Sonidos sintéticos generados con Web Audio API (sin archivos externos).
// Estética dark fantasy: graves cálidos, un tañido cristalino para el platino.

let ctx: AudioContext | null = null;
let muted = false;

// Lee/escribe la preferencia de silencio en memoria (no localStorage por las
// restricciones del entorno; se reinicia por sesión).
export function isMuted() {
  return muted;
}
export function setMuted(value: boolean) {
  muted = value;
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Algunos navegadores suspenden el contexto hasta que hay interacción.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Whoosh grave al abrir/lanzar un juego. */
export function playWhoosh() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.35);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.42);
}

/** Tañido cristalino al platinar (dos tonos en acorde, con cola). */
export function playPlatinum() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;

  // Acorde de campana: fundamental + quinta + octava.
  const freqs = [523.25, 783.99, 1046.5];
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const start = now + i * 0.05;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + 1.3);
  });
}

/** Click suave al abrir el panel de un juego. */
export function playTick() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}
