let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // Standard and cross-browser AudioContext initialization
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  return audioCtx;
}

export function playPickupSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Warm, sub-bass pluck
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio Context playback ignored before active user interaction.");
  }
}

export function playSnapSound() {
  try {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode1 = ctx.createGain();
    const gainNode2 = ctx.createGain();

    osc1.connect(gainNode1);
    gainNode1.connect(ctx.destination);
    
    osc2.connect(gainNode2);
    gainNode2.connect(ctx.destination);

    const now = ctx.currentTime;

    // Woodblock double-click
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(450, now);
    osc1.frequency.exponentialRampToValueAtTime(540, now + 0.04);
    gainNode1.gain.setValueAtTime(0.25, now);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(900, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(1100, now + 0.06);
    gainNode2.gain.setValueAtTime(0.15, now + 0.02);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc1.start(now);
    osc1.stop(now + 0.1);
    
    osc2.start(now + 0.02);
    osc2.stop(now + 0.12);
  } catch (e) {
    // Ignore audio warnings
  }
}

export function playClickSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Ignore context warnings
  }
}

export function playWinSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Arpeggiated lush major chord sweep
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      
      // Delay the start of each note for a harp-like arpeggiated sweep
      const noteDelay = index * 0.08;
      const noteStart = now + noteDelay;

      osc.frequency.setValueAtTime(freq, noteStart);
      
      // Add vibrato/tremolo
      osc.frequency.linearRampToValueAtTime(freq + 4, noteStart + 0.4);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.08, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 1.2);

      osc.start(noteStart);
      osc.stop(noteStart + 1.5);
    });
  } catch (e) {
    // Ignore warnings
  }
}
