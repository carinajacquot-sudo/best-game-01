// audio.js: fully procedural synthwave soundtrack engine + alien radio voices + arcade SFX.
// 100% Web Audio — zero audio files, zero dependencies. A lookahead scheduler drives five
// original themes (title / play / boss / victory / gameover) through synthesized instruments
// (kick, snare, hats, bass, arp, lead, pad, bell) with delay + generated-impulse reverb sends
// and a kick sidechain pump. Bosses "speak" through a formant-swept alien radio voice.

const BOSS_PITCH = {
  'Glass Manta': 96,
  'Thorn Choir': 82,
  'Prism Forge': 74,
  'Twin Tides': 88,
  'Cinder Warden': 70,
  'Veil Engine': 58,
  'Lantern Carrier': 66,
  'Rail Saint': 62,
  'Eclipse Maw': 50,
  'Crown of Silence': 44,
};

// Four formant sets (Hz) cycled per syllable — the "vowel" of the alien radio voice.
const FORMANTS = [
  [300, 750, 480],
  [500, 900, 650],
  [250, 600, 900],
  [400, 800, 1200],
];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.musicRequested = false;
    this.root = 110; // A2
    this.sector = 1;
    this.bossMode = false;
    this.scale = [0, 3, 5, 7, 10, 12, 15, 17]; // A minor pentatonic
    this.themeName = 'title';
    this.currentTheme = 'title';
    this.nextNoteTime = 0;
    this.lastBassFreq = 0;
    this.buses = null;
    this.noiseBuffer = null;
    this.clipCurve = null;
  }

  setSector(sector) {
    const roots = [110, 98, 130.81, 103.83, 116.54, 92.5, 123.47, 87.31, 138.59, 98];
    this.sector = Math.max(1, Math.min(10, sector));
    this.root = roots[this.sector - 1];
  }

  setBossMode(active) {
    this.bossMode = !!active;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4.5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.16;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Shared white-noise buffer (1 s) for drums, risers and radio static.
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // Hard-clip waveshaper curve for the alien voice grit.
      this.clipCurve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        this.clipCurve[i] = Math.max(-1, Math.min(1, x * 3));
      }

      this._buildBuses();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  _buildBuses() {
    const ctx = this.ctx;
    // Music bus -> master (drums + bass + arp + lead).
    const music = ctx.createGain();
    music.gain.value = 0.9;
    music.connect(this.master);
    // Bass + pad buses get sidechain-pumped by the kick.
    const bass = ctx.createGain();
    bass.connect(music);
    const pad = ctx.createGain();
    pad.connect(music);
    // Arp bus with a slow stereo pan LFO.
    const arp = ctx.createGain();
    const arpPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (arpPan) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.3;
      lfo.connect(lfoGain);
      lfoGain.connect(arpPan.pan);
      lfo.start();
      arp.connect(arpPan);
      arpPan.connect(music);
    } else {
      arp.connect(music);
    }
    // Delay send: dotted-eighth feel, feedback loop with a dark lowpass.
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.375;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.37;
    const delayLp = ctx.createBiquadFilter();
    delayLp.type = 'lowpass';
    delayLp.frequency.value = 2400;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.22;
    delay.connect(delayLp);
    delayLp.connect(delayFb);
    delayFb.connect(delay);
    delayLp.connect(delayWet);
    delayWet.connect(music);
    // Reverb send: convolver with a generated 2.3 s exponential-decay impulse.
    const reverb = ctx.createConvolver();
    const irLen = Math.floor(ctx.sampleRate * 2.3);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
      }
    }
    reverb.buffer = ir;
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.3;
    reverb.connect(reverbWet);
    reverbWet.connect(music);
    this.buses = { music, bass, pad, arp, delay, reverb };
  }

  _setDelayTime(bpm) {
    if (!this.buses) return;
    const beat = 60 / bpm;
    this.buses.delay.delayTime.setValueAtTime(beat * 0.75, this.ctx.currentTime);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, this.ctx.currentTime, 0.035);
    }
    return this.muted;
  }

  // ---------- theme / transport ----------

  setTheme(name) {
    this.themeName = name;
    this.currentTheme = name;
    if (!this.ctx) return;
    this._setDelayTime(this._themeBpm(name));
    // Restart the pattern at bar 0 for a clean transition.
    this.step = 0;
    this.lastBassFreq = 0;
    if (this.musicTimer) {
      this.nextNoteTime = this.ctx.currentTime + 0.06;
    }
  }

  _themeBpm(name) {
    if (name === 'boss') return 136;
    if (name === 'play') return 122;
    if (name === 'victory') return 100;
    if (name === 'gameover') return 66;
    return 92; // title
  }

  startMusic() {
    this.musicRequested = true;
    if (this.musicTimer) return;
    this.init();
    if (!this.ctx) return;
    this._setDelayTime(this._themeBpm(this.themeName));
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.step = 0;
    // Lookahead scheduler: 25 ms timer, schedule 0.15 s ahead (no drift).
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      if (this.muted) {
        this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.06);
        return;
      }
      const bpm = this._themeBpm(this.themeName);
      const stepDur = 60 / bpm / 4; // 16th notes
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        this._scheduleStep(this.step, this.nextNoteTime, bpm);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % 64; // 4 bars of 16 steps
      }
    }, 25);
  }

  stopMusic() {
    this.musicRequested = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  _scheduleStep(s, t, bpm) {
    const theme = this.themeName;
    const bar = Math.floor(s / 16) % 4;
    const sib = s % 16;
    const root = this.root;
    const semi = (n) => root * Math.pow(2, n / 12);

    if (theme === 'play') {
      const chord = [0, -4, 3, -2][bar]; // Am - F - C - G
      if (sib % 4 === 0) this._kick(t, 0.9);
      if (sib === 13) this._kick(t, 0.55); // syncopated off-beat
      if (sib === 4 || sib === 12) this._snare(t, 0.5);
      if (sib % 2 === 0) this._hat(t, 0.035, 0.16);
      if (sib % 2 === 0) {
        const oct = (sib === 6 || sib === 14) ? 12 : 0;
        this._bass(t, semi(chord + oct), 0.26, 0.3);
      }
      const arpPat = [0, 3, 7, 10, 12, 15, 12, 10, 7, 3, 7, 10, 15, 12, 10, 7];
      const cutoff = 600 + (bar / 3) * 2000; // filter opens across the loop
      this._arp(t, semi(chord + arpPat[sib]), 0.09, 0.11, cutoff);
      if (sib === 0) {
        const third = bar === 0 ? 3 : 4; // Am is minor, F/C/G are major
        this._pad(t, [chord, chord + third, chord + 7], 60 / bpm * 4, 0.05);
      }
      if (bar % 2 === 0 && sib % 4 === 0) {
        const motif = [12, 15, 19, 15][sib / 4];
        this._lead(t, semi(chord + motif), 0.5, 0.07);
      }
    } else if (theme === 'boss') {
      const chord = [0, -1, 0, -2][bar]; // Am - Ab - Am - G (phrygian descent)
      if (sib % 4 === 0) this._kick(t, 1.0);
      if (bar % 2 === 1 && (sib === 7 || sib === 13)) this._kick(t, 0.6);
      if (sib === 4 || sib === 12) this._snare(t, 0.55);
      this._hat(t, 0.03, 0.13); // hats every step — party of dread
      const bassSteps = { 0: 0, 2: 0, 5: 3, 8: 0, 10: 10, 12: 12, 14: 10 };
      if (sib in bassSteps) this._bass(t, semi(chord + bassSteps[sib]), 0.22, 0.34);
      const arpPat = [0, 3, 6, 10, 12, 15, 18, 15];
      if (sib % 2 === 0) this._arp(t, semi(chord + arpPat[(sib / 2) % 8]), 0.06, 0.13, 1600);
      if (sib === 12) this._tritoneStab(t); // tritone color stab every bar
      if (sib === 0) this._pad(t, [chord, chord + 7, chord + 12], 60 / bpm * 4, 0.055);
    } else if (theme === 'victory') {
      const C = 130.81; // C3 — victory lives in C major regardless of sector
      const chords = [0, 7, 9, 5]; // C - G - Am - F
      const chord = chords[bar];
      const f = (n) => C * Math.pow(2, n / 12);
      if (sib % 4 === 0) this._kick(t, 0.65);
      if (sib === 4 || sib === 12) this._snare(t, 0.4);
      if (sib % 4 === 2) this._hat(t, 0.16, 0.12, true); // open hats off-beat
      else if (sib % 2 === 0) this._hat(t, 0.035, 0.08);
      if (sib === 0 || sib === 8) this._bass(t, f(chord), 0.4, 0.26);
      if (sib === 4 || sib === 12) this._bass(t, f(chord + 7), 0.4, 0.22);
      // Soaring lead: an uplifting 4th/6th motif over the C-G-Am-F loop.
      const leadLine = [
        [12, 16, 19, 24],
        [14, 19, 23, 26],
        [12, 16, 19, 21],
        [17, 21, 24, 29],
      ][bar];
      if (sib % 4 === 0) this._lead(t, f(leadLine[sib / 4]), 0.9, 0.09);
      if (sib === 0) this._pad(t, [chord, chord + 4, chord + 7], 60 / bpm * 4, 0.05, C * 2);
      if (bar === 0 && sib === 0) this._bell(t, 1046.5, 2.8, 0.16); // C6 chime
    } else if (theme === 'gameover') {
      if (sib === 0 || sib === 8) this._kick(t, 0.5); // heartbeat
      if (sib === 0) {
        this._bass(t, root / 2, 1.6, 0.3); // A1 drone
        this._bell(t, 220, 3.2, 0.14); // A3 toll
      }
      if (sib === 0) this._pad(t, [0, 3, 7], 60 / bpm * 4, 0.045);
    } else {
      // title — 92 BPM half-time phrygian drone
      if (sib === 0 || sib === 8) this._kick(t, 0.45);
      if (sib === 8) this._snare(t, 0.22);
      if (sib === 4 || sib === 12) this._hat(t, 0.04, 0.07);
      if (sib === 0 || sib === 8) this._bass(t, root / 2, 0.9, 0.24); // A1 on 1 & 3
      if (sib % 2 === 0) {
        const pent = [0, 3, 7, 10, 12][(sib / 2) % 5];
        this._arp(t, semi(pent), 0.14, 0.05, 900);
      }
      const padRoots = [5, 0, 7, 0]; // Dm - Am - Em - Am
      if (sib === 0) this._pad(t, [padRoots[bar], padRoots[bar] + 3, padRoots[bar] + 7], 60 / bpm * 4, 0.05);
      if (bar % 2 === 0 && sib === 0) this._bell(t, 659.25, 2.4, 0.08); // E5 every 2 bars
    }
  }

  // ---------- instruments ----------

  _pump(t) {
    // Sidechain: dip bass + pad buses on the kick, recover over ~110 ms.
    if (!this.buses) return;
    for (const bus of [this.buses.bass, this.buses.pad]) {
      const g = bus.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.45, t);
      g.exponentialRampToValueAtTime(1.0, t + 0.11);
    }
  }

  _kick(t, level = 0.9) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.24);
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.buses.music);
    osc.start(t);
    osc.stop(t + 0.3);
    // Click transient.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.18 * level, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
    src.connect(hp);
    hp.connect(cg);
    cg.connect(this.buses.music);
    src.start(t, Math.random() * 0.5, 0.012);
    this._pump(t);
  }

  _snare(t, level = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.buses.music);
    src.start(t, Math.random() * 0.5, 0.18);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 186;
    const og = ctx.createGain();
    og.gain.setValueAtTime(level * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og);
    og.connect(this.buses.music);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  _hat(t, dur, level, open = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 7500 : 7800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.buses.music);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  _bass(t, freq, dur, level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    // Portamento glide from the previous bass note (40 ms).
    if (this.lastBassFreq > 0) {
      osc.frequency.setValueAtTime(this.lastBassFreq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq), t + 0.04);
    } else {
      osc.frequency.setValueAtTime(Math.max(25, freq), t);
    }
    this.lastBassFreq = freq;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(Math.max(20, freq / 2), t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(950, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    sub.connect(lp);
    lp.connect(gain);
    gain.connect(this.buses.bass);
    osc.start(t);
    sub.start(t);
    osc.stop(t + dur + 0.02);
    sub.stop(t + dur + 0.02);
  }

  _arp(t, freq, dur, level, cutoff) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = Math.max(25, freq);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = cutoff || 1200;
    bp.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(bp);
    bp.connect(gain);
    gain.connect(this.buses.arp);
    gain.connect(this.buses.delay);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _lead(t, freq, dur, level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    lp.connect(gain);
    gain.connect(this.buses.music);
    gain.connect(this.buses.delay);
    for (const detune of [-9, 9]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = Math.max(25, freq);
      osc.detune.value = detune;
      // Vibrato: 5.6 Hz LFO, ±6 cents.
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.6;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 6;
      vib.connect(vibGain);
      vibGain.connect(osc.detune);
      osc.connect(lp);
      osc.start(t);
      vib.start(t);
      osc.stop(t + dur + 0.02);
      vib.stop(t + dur + 0.02);
    }
  }

  _pad(t, semis, dur, level, baseFreq = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const base = baseFreq || this.root * 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.8);
    gain.gain.setValueAtTime(level, t + Math.max(0.8, dur - 0.4));
    gain.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
    gain.connect(this.buses.pad);
    gain.connect(this.buses.reverb);
    for (const n of semis) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = base * Math.pow(2, n / 12);
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + dur + 1.3);
    }
  }

  _bell(t, freq, dur, level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    gain.connect(this.buses.music);
    gain.connect(this.buses.reverb);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 4.2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    o1.connect(gain);
    o2.connect(g2);
    g2.connect(gain);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  _tritoneStab(t) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (const freq of [110, 155.56]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 14;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.buses.music);
      osc.start(t);
      osc.stop(t + 0.32);
    }
  }

  // ---------- alien radio voice ----------

  _bossPitch(name) {
    if (BOSS_PITCH[name]) return BOSS_PITCH[name];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return 44 + (h % 52);
  }

  _alienSyllable(t, dur, freq, formantIdx) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(Math.max(25, freq), t);
    carrier.frequency.exponentialRampToValueAtTime(Math.max(25, freq * 1.06), t + dur);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.clipCurve;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    env.gain.setValueAtTime(0.5, t + dur - 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.connect(shaper);
    shaper.connect(env);
    // Three parallel formant bandpasses (the alien "vowels").
    const formants = FORMANTS[formantIdx % FORMANTS.length];
    const formantGains = [0.5, 0.35, 0.25];
    const sum = ctx.createGain();
    sum.gain.value = 0.6;
    formants.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 9;
      const fg = ctx.createGain();
      fg.gain.value = formantGains[i];
      carrier.connect(bp); // dry carrier also feeds formants via shaper path below
      bp.connect(fg);
      fg.connect(sum);
    });
    // Radio AM: 13-23 Hz tremolo on the summed formants.
    const am = ctx.createGain();
    am.gain.value = 0.7;
    const amLfo = ctx.createOscillator();
    amLfo.frequency.value = 13 + (formantIdx * 3.7) % 10;
    const amDepth = ctx.createGain();
    amDepth.gain.value = 0.35;
    amLfo.connect(amDepth);
    amDepth.connect(am.gain);
    env.connect(sum);
    sum.connect(am);
    am.connect(this.buses.music);
    am.connect(this.buses.reverb);
    carrier.start(t);
    amLfo.start(t);
    carrier.stop(t + dur + 0.02);
    amLfo.stop(t + dur + 0.02);
  }

  _staticBurst(t, dur, level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000;
    bp.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.buses.music);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  playBossEntrance(name) {
    this.init();
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + 0.05;
    const base = this._bossPitch(name || '');
    const multipliers = [0.92, 1.0, 1.12]; // rising arc over 3 syllables
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.37;
      this._alienSyllable(t, 0.28, base * multipliers[i], i);
      this._staticBurst(t + 0.28, 0.02, 0.15); // radio click between syllables
    }
  }

  playBossDown(name) {
    this.init();
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + 0.05;
    const base = this._bossPitch(name || '');
    const multipliers = [1.1, 0.86, 0.68, 0.52]; // descending death rattle
    for (let i = 0; i < 4; i++) {
      this._alienSyllable(t0 + i * 0.3, 0.24, base * multipliers[i], i + 1);
    }
    // Sub boom + tail static.
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t0 + 1.2);
    osc.frequency.exponentialRampToValueAtTime(28, t0 + 2.0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t0 + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.1);
    osc.connect(gain);
    gain.connect(this.buses.music);
    osc.start(t0 + 1.2);
    osc.stop(t0 + 2.15);
    this._staticBurst(t0 + 1.3, 0.4, 0.1);
  }

  // ---------- SFX helpers (kept from v6, routed through the new buses) ----------

  tone(freq, time, duration, { type = 'triangle', volume = 0.08, endFreq = null, pan = 0, cutoff = 5000 } = {}) {
    if (!this.ctx || !this.master || this.muted) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(25, freq), time);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFreq), time + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, cutoff * 0.45), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(pan, time);
      gain.connect(panner);
      panner.connect(this.master);
    } else gain.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  noise(time, duration, volume, cutoff, pan = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, time);
      gain.connect(panner);
      panner.connect(this.master);
    } else gain.connect(this.master);
    source.start(time);
    source.stop(time + duration);
  }

  playShoot() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this.tone(760, now, 0.095, { type: 'square', volume: 0.035, endFreq: 310, cutoff: 3200, pan: -0.1 });
    this.tone(1520, now, 0.045, { type: 'sine', volume: 0.018, endFreq: 680, cutoff: 5000, pan: 0.1 });
  }

  playHit() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this.tone(170, now, 0.24, { type: 'sawtooth', volume: 0.11, endFreq: 42, cutoff: 850 });
    this.noise(now, 0.16, 0.07, 900, -0.15);
  }

  playBoom() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this.noise(now, 0.34, 0.15, 1300, (Math.random() - 0.5) * 0.5);
    this.tone(95, now, 0.38, { type: 'sine', volume: 0.17, endFreq: 30, cutoff: 240 });
    this.tone(260, now, 0.18, { type: 'triangle', volume: 0.045, endFreq: 70, cutoff: 800 });
  }

  playPickup() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 4, 7, 12].forEach((n, i) => this.tone(440 * Math.pow(2, n / 12), now + i * 0.055, 0.22, { type: 'sine', volume: 0.055, cutoff: 3000 }));
  }

  playPulse() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this.noise(now, 0.55, 0.12, 2200);
    [0, 7, 12, 19].forEach((n, i) => {
      const f = 110 * Math.pow(2, n / 12);
      this.tone(f, now + i * 0.035, 0.62, { type: 'sine', volume: 0.075, endFreq: f * 1.5, cutoff: 3600, pan: (i - 1.5) * 0.18 });
    });
    this.tone(48, now, 0.48, { type: 'sine', volume: 0.19, endFreq: 25, cutoff: 150 });
  }

  playUI() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this.tone(587.33, now, 0.11, { type: 'sine', volume: 0.055, cutoff: 2500 });
    this.tone(880, now + 0.035, 0.14, { type: 'triangle', volume: 0.035, cutoff: 3000 });
  }

  // ---------- new v7 SFX ----------

  playPhaseShift() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._tritoneStab(now);
    // Riser: bandpassed noise sweeping up.
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(3200, now + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.buses.music);
    src.start(now, Math.random() * 0.5, 0.62);
    // Sub drop.
    this.tone(70, now, 0.5, { type: 'sine', volume: 0.22, endFreq: 31, cutoff: 160 });
  }

  playLantern() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._bell(now, 1318.5, 0.9, 0.18); // E6 — the relight moment
    this._bell(now + 0.12, 2637, 0.5, 0.08); // E7 shimmer
  }

  playVictorySting() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [261.63, 329.63, 392, 523.25].forEach((f, i) => {
      this.tone(f, now + i * 0.13, 0.35, { type: 'sawtooth', volume: 0.07, cutoff: 2800 });
      this.tone(f, now + i * 0.13, 0.35, { type: 'triangle', volume: 0.05, cutoff: 3200 });
    });
    this._bell(now + 0.52, 1046.5, 2.4, 0.14); // C6 on top
  }

  playGameOverSting() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this._bell(now + i * 1.4, 110, 2.6, 0.2); // A1 tolls
    }
  }
}
