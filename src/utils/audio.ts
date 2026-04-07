export function playBeep(frequency = 880, duration = 0.15, repeatCount = 1) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  const repeatDelay: number = 0.2;
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;

    let audioCtx: AudioContext | null = null;
    let activeContexts = 0;

    const playBeepOnce = () => {
      // Create new context for each beep if needed
      if (!audioCtx) {
        audioCtx = new AudioContext();
      }

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

      activeContexts++;
      oscillator.onended = () => {
        activeContexts--;
        if (activeContexts === 0 && audioCtx) {
          audioCtx.close().catch(() => {});
          audioCtx = null;
        }
      };
    };

    // Play beeps with delays
    for (let i = 0; i < repeatCount; i++) {
      const delayMs = i * (duration + repeatDelay) * 1000;
      setTimeout(playBeepOnce, delayMs);
    }
  } catch {
    // Browser may block autoplay/permissions, ignore safely.
  }
}

export function speakExercise(text: string, rate = 1) {
  if (typeof window === "undefined") return;

  // Cancel any ongoing speech
  window.speechSynthesis?.cancel();

  try {
    const utterance = new SpeechSynthesisUtterance(text);

    // Set language to Polish
    utterance.lang = "pl-PL";
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech Synthesis not available:", err);
  }
}
