"use client";

/**
 * On-device Web Audio API feedback synthesizer & Web Speech API pronunciation.
 * Zero external requests, zero external audio dependencies.
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = "sine",
  peakGain = 0.14,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + startOffset;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playTapSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 520, 0, 0.055, "triangle", 0.07);
}

export function playCorrectSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // Bright ascending two-tone major chime (C5 → G5)
  playTone(ctx, 523.25, 0, 0.14, "triangle", 0.14);
  playTone(ctx, 783.99, 0.09, 0.22, "triangle", 0.15);
}

export function playIncorrectSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // Gentle low descending tone (E3 → C3)
  playTone(ctx, 196.0, 0, 0.16, "sawtooth", 0.08);
  playTone(ctx, 146.83, 0.11, 0.24, "sawtooth", 0.07);
}

export function playComboSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 523.25, 0, 0.11, "triangle", 0.12);
  playTone(ctx, 659.25, 0.07, 0.12, "triangle", 0.13);
  playTone(ctx, 783.99, 0.14, 0.18, "triangle", 0.15);
}

export function playVictoryFanfare(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    playTone(ctx, freq, idx * 0.09, idx === notes.length - 1 ? 0.42 : 0.15, "triangle", 0.15);
  });
}

/** On-device English TTS using the browser's built-in SpeechSynthesis. */
export function speakEnglish(text: string, options?: { slow?: boolean }): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = options?.slow ? 0.68 : 0.96;
    utterance.pitch = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => /^en[-_](US|GB)/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function isSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
