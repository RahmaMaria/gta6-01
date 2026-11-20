// Synthesised sound for Neon Harbor. Everything is WebAudio built
// from oscillators and noise — no audio files, no network. The context
// is created lazily on the first user gesture and every call is
// guarded, so a headless run or a browser without audio never crashes.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    musicStep: 0,
    musicTimer: 0,
    muted: false,
  };
}

// Create the context. Call only from a user gesture (keydown/click).
export function unlockAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === "suspended") audio.ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    startEngine(audio);
    startSiren(audio);
  } catch (err) {
    audio.ctx = null;
  }
}

function startEngine(audio) {
  try {
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = "sawtooth";
    audio.engineOsc.frequency.value = 40;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
  } catch (err) {
    audio.engineOsc = null;
  }
}

function startSiren(audio) {
  try {
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = "triangle";
    audio.sirenOsc.frequency.value = 660;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  } catch (err) {
    audio.sirenOsc = null;
  }
}

// Short noise burst for a gunshot.
export function playShot(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const dur = 0.14;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(gain);
    gain.connect(audio.master);
    src.start();
  } catch (err) {
    // Sound is cosmetic; never let it break the game.
  }
}

// Two-note pickup blip.
export function playBlip(audio, freq) {
  if (!audio.ctx || audio.muted) return;
  try {
    const osc = audio.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq || 660;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0.35, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.2);
  } catch (err) {
    // Ignore audio failures.
  }
}

// Cash-register style chime for a mission payout.
export function playPayout(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = audio.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = audio.ctx.createGain();
      const t = audio.ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (err) {
    // Ignore audio failures.
  }
}

// Per-frame audio update: engine hum follows speed, siren wails with
// the wanted level, and a simple bassline keeps the bay moving.
export function updateAudio(audio, dt, state) {
  if (!audio.ctx) return;
  // Muting must silence the loops immediately, not on the next unmute.
  if (audio.muted) {
    try {
      if (audio.engineGain) audio.engineGain.gain.value = 0;
      if (audio.sirenGain) audio.sirenGain.gain.value = 0;
    } catch (err) {
      // Ignore audio failures.
    }
    return;
  }
  try {
    const speed = state.playerCar ? Math.abs(state.playerCar.speed) : 0;
    const driving = !!state.playerCar;
    if (audio.engineGain) {
      audio.engineGain.gain.value = driving ? 0.05 + Math.min(0.09, speed / 9000) : 0;
    }
    if (audio.engineOsc) {
      audio.engineOsc.frequency.value = 42 + speed * 0.16;
    }
    if (audio.sirenGain && audio.sirenOsc) {
      const wanted = state.wanted || 0;
      audio.sirenGain.gain.value = wanted > 0 ? 0.05 : 0;
      audio.sirenTimer += dt;
      const twoTone = Math.floor(audio.sirenTimer * 2.4) % 2 === 0;
      audio.sirenOsc.frequency.value = twoTone ? 715 : 540;
    }
    // Bassline: a 8-step loop in A minor, one step per 0.21 s.
    audio.musicTimer += dt;
    if (audio.musicTimer >= 0.21) {
      audio.musicTimer -= 0.21;
      const bass = [55, 55, 65.41, 55, 49, 55, 82.41, 73.42];
      const freq = bass[audio.musicStep % bass.length];
      audio.musicStep++;
      const osc = audio.ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(0.5, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audio.musicGain);
      osc.start();
      osc.stop(audio.ctx.currentTime + 0.22);
    }
  } catch (err) {
    // Ignore audio failures.
  }
}
