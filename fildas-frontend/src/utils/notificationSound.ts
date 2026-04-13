let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

export function playNotificationChime() {
  try {
    const pref = localStorage.getItem("pref_sound_notif");
    if (pref === "false") return;

    const ctx = getAudioContext();

    // Ensure context is resumed (browsers auto-suspend audio)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    // Two-tone soft chime
    const notes = [880, 1100];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(
        0.18,
        ctx.currentTime + i * 0.18 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.18 + 0.4,
      );

      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    // ignore — audio may be blocked before user interaction
  }
}
