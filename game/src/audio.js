// audio.js: lightweight synthesized synthwave score and expressive arcade sound effects.
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
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.008;
      this.compressor.release.value = 0.18;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, this.ctx.currentTime, 0.035);
    }
    if (this.muted && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    } else if (!this.muted && this.musicRequested) {
      this.startMusic();
    }
    return this.muted;
  }

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

  startMusic() {
    this.musicRequested = true;
    if (this.muted || this.musicTimer) return;
    this.init();
    if (!this.ctx) return;
    // 100 BPM, 16th-note pulse: bass, a rotating pentatonic arp, and soft hats.
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime + 0.015;
      const s = this.step;
      const bar = Math.floor(s / 16) % 4;
      const chord = [0, -4, 3, -2][bar]; // Am – F – C – G, an original four-bar night-flight theme.
      const arpIndex = [0, 2, 4, 7, 4, 2, 5, 4][s % 8];
      const arpFreq = this.root * Math.pow(2, (chord + this.scale[arpIndex]) / 12);
      const intensity = this.bossMode ? 1.28 : 1;
      this.tone(arpFreq, now, 0.16, { type: 'triangle', volume: (s % 4 === 0 ? 0.038 : 0.024) * intensity, cutoff: 2800, pan: (s % 4 - 1.5) * 0.12 });
      // A short, singable lantern motif floats above the arpeggio every eighth-note.
      const motif = [0, 7, 12, 7, 3, 0, -2, 0, 7, 12, 14, 12, 7, 3, 0, -2];
      if (s % 2 === 0) {
        const lead = this.root * 4 * Math.pow(2, (chord + motif[s % 16]) / 12);
        this.tone(lead, now, 0.3, { type: 'sine', volume: (s % 8 === 0 ? 0.034 : 0.022) * intensity, cutoff: 3400, pan: s % 4 === 0 ? -0.18 : 0.18 });
      }
      if (this.bossMode && s % 8 === 6) this.noise(now, 0.075, 0.035, 2600, 0.2);
      if (s % 4 === 0) {
        const bassFreq = this.root * Math.pow(2, chord / 12);
        this.tone(bassFreq, now, 0.42, { type: 'sawtooth', volume: 0.09, endFreq: bassFreq * 0.72, cutoff: 520 });
        this.tone(55, now, 0.2, { type: 'sine', volume: 0.11, endFreq: 33, cutoff: 140 });
      }
      if (s % 8 === 4) this.noise(now, 0.12, 0.025, 1800, s % 16 === 4 ? -0.2 : 0.2);
      else if (s % 2 === 0) this.noise(now, 0.045, 0.009, 7000, s % 4 === 0 ? -0.45 : 0.45);
      if (s % 16 === 0) {
        (bar === 0 ? [0, 3, 7, 12] : [0, 4, 7, 12]).forEach((interval, i) => {
          const f = this.root * Math.pow(2, (chord + interval) / 12);
          this.tone(f, now, 1.8, { type: 'sine', volume: 0.009, cutoff: 1200, pan: i === 0 ? -0.25 : i === 2 ? 0.25 : 0 });
        });
      }
      this.step++;
    }, 150);
  }

  stopMusic() {
    this.musicRequested = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
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
}
