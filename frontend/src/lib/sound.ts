/** Gentle two-tone chime for a private nudge, synthesised so no audio asset is needed. */
export function playNudgeSound(): void {
  try {
    const context = new AudioContext();
    const now = context.currentTime;
    const tones: Array<[number, number]> = [
      [660, 0],
      [880, 0.18],
    ];
    for (const [frequency, offset] of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.15, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.4);
    }
    setTimeout(() => void context.close(), 1000);
  } catch {
    // audio blocked until user interaction; the banner is still shown
  }
}
