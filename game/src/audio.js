// Synthesised sound: no audio files, everything is WebAudio oscillators and
// filtered noise. A low bass line keeps time under the game, the engine hum
// follows the player's speed, sirens wail while the wanted level is up, and
// shots, pickups and mission jingles are short blips. Every call is guarded:
// in a headless screenshot run there may be no audio at all, and the game
// must never fail because of it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;
  let nextNoteTime = 0;

  // A minor-key bass walk, one note per eighth at 112 BPM.
  const BASS = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
  const STEP_TIME = 60 / 112 / 2;

  function ensure() {
    if (ctx !== null) return ctx !== null;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      nextNoteTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      noise(0.09, 0.5, 2400);
    },
    thugShoot() {
      noise(0.08, 0.3, 1600);
    },
    hit() {
      blip(180, 0.12, 'square', 0.25);
    },
    pickup() {
      blip(880, 0.1, 'sine', 0.3);
      blip(1320, 0.14, 'sine', 0.3, 0.08);
    },
    mission() {
      blip(523, 0.12, 'triangle', 0.35);
      blip(659, 0.12, 'triangle', 0.35, 0.11);
      blip(784, 0.22, 'triangle', 0.35, 0.22);
    },
    crash() {
      noise(0.25, 0.5, 500);
    },
    click() {
      blip(660, 0.06, 'sine', 0.25);
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.25, 'triangle', 0.35, i * 0.14));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.22, i * 0.18));
    },
    /** Per-frame: engine hum follows speed, sirens follow wanted level, bass keeps time. */
    update(dt, speedNorm, wanted) {
      if (!ensure() || muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      try {
        if (ctx.state !== 'running') return;
        if (engineOsc) engineOsc.frequency.value = 46 + speedNorm * 130;
        if (engineGain) engineGain.gain.value = 0.02 + speedNorm * 0.05;
        if (sirenOsc && sirenGain) {
          if (wanted > 0) {
            const t = ctx.currentTime;
            sirenOsc.frequency.setValueAtTime(660 + 160 * Math.sin(t * 4.2), t);
            sirenGain.gain.value = 0.045;
          } else {
            sirenGain.gain.value = 0;
          }
        }
        musicTimer += dt;
        while (nextNoteTime < ctx.currentTime + 0.15) {
          const freq = BASS[musicStep % BASS.length];
          if (freq > 0) {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.16, nextNoteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + STEP_TIME * 0.95);
            osc.connect(gain);
            gain.connect(master);
            osc.start(nextNoteTime);
            osc.stop(nextNoteTime + STEP_TIME);
          }
          musicStep += 1;
          nextNoteTime += STEP_TIME;
        }
      } catch {
        // Sound is garnish; never let it break the game.
      }
    },
  };
}
