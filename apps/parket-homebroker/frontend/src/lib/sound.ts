/**
 * Sound center — sons curtos pra eventos importantes.
 * Preferência global em localStorage (hb-sound-muted).
 */

export type SoundKind = "ganho" | "perda" | "novo-lead" | "msg-recebida" | "atribuicao";

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (_ctx) return _ctx;
  const C = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  _ctx = new C();
  return _ctx;
}

function tone(freq: number, durationMs: number, startMs = 0, type: OscillatorType = "sine", gain = 0.05) {
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime + startMs / 1000;
  const t1 = t0 + durationMs / 1000;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);
  o.start(t0); o.stop(t1);
}

export function isMuted(): boolean {
  return localStorage.getItem("hb-sound-muted") === "1";
}
export function setMuted(m: boolean) {
  localStorage.setItem("hb-sound-muted", m ? "1" : "0");
  window.dispatchEvent(new CustomEvent("hb-sound-changed"));
}

export function playSound(kind: SoundKind) {
  if (isMuted()) return;
  try {
    switch (kind) {
      case "ganho":
        // acorde ascendente discreto: C5 → E5 → G5
        tone(523, 150, 0); tone(659, 150, 100); tone(784, 250, 200);
        break;
      case "perda":
        // descendente curto
        tone(440, 200, 0); tone(330, 250, 150, "sine", 0.04);
        break;
      case "novo-lead":
        // bip único curto
        tone(880, 180);
        break;
      case "msg-recebida":
        // bip bem sutil
        tone(880, 120, 0, "sine", 0.03);
        break;
      case "atribuicao":
        // duplo bip
        tone(660, 200); tone(990, 200, 180);
        break;
    }
  } catch {}
}
