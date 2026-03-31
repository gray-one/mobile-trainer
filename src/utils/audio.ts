export function playBeep(frequency = 880, duration = 0.15) {
  if (typeof window === "undefined" || !window.AudioContext) return;

  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);

    oscillator.onended = () => {
      audioCtx.close().catch(() => {});
    };
  } catch {
    // Browser may block autoplay/permissions, ignore safely.
  }
}
