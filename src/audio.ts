/** All sound is synthesized with WebAudio, so the app ships no audio assets. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private track: TrackName = 'river';
  soundOn = true;
  musicOn = true;

  /** Must be called from a user gesture (iOS requirement). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1);
  }

  private ready(key: string, minGap: number) {
    if (!this.soundOn || !this.ctx || !this.master || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(key) ?? -1;
    if (now - last < minGap) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, dest?: AudioNode) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest ?? this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private hiss(dur: number, freq: number, q: number, vol: number, delay = 0, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + dur + 0.02);
  }

  bow() {
    if (!this.ready('bow', 0.09)) return;
    this.hiss(0.12, 2600 + Math.random() * 800, 1.5, 0.12);
    this.tone(220 + Math.random() * 40, 0.08, 'triangle', 0.05, 120);
  }

  hit() {
    if (!this.ready('hit', 0.05)) return;
    this.hiss(0.06, 900, 2, 0.12);
  }

  gateGood() {
    if (!this.ready('gate', 0.2)) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.18, undefined, i * 0.06));
  }

  gateBad() {
    if (!this.ready('gate', 0.2)) return;
    this.tone(330, 0.35, 'sawtooth', 0.12, 140);
  }

  pop() {
    if (!this.ready('pop', 0.04)) return;
    this.tone(700 + Math.random() * 300, 0.1, 'square', 0.07, 1400);
  }

  crash() {
    if (!this.ready('crash', 0.08)) return;
    this.hiss(0.35, 500, 0.8, 0.3);
    this.tone(120, 0.25, 'triangle', 0.25, 60);
  }

  clash() {
    if (!this.ready('clash', 0.07)) return;
    this.hiss(0.08, 3500, 3, 0.1);
    this.tone(1800 + Math.random() * 600, 0.06, 'square', 0.03);
  }

  smash() {
    if (!this.ready('smash', 0.2)) return;
    this.tone(90, 0.5, 'sine', 0.6, 40);
    this.hiss(0.5, 300, 0.7, 0.4, 0, 'lowpass');
  }

  roar(rage = false) {
    if (!this.ready(rage ? 'rage' : 'roar', 1)) return;
    this.tone(110, 0.8, 'sawtooth', 0.18, 70);
    this.tone(82, 0.9, 'sawtooth', 0.12, 55);
  }

  coin() {
    if (!this.ready('coin', 0.06)) return;
    this.tone(988, 0.07, 'square', 0.08);
    this.tone(1319, 0.2, 'square', 0.08, undefined, 0.07);
  }

  whoosh() {
    if (!this.ready('whoosh', 0.2)) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(1600, t0 + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + 0.5);
  }

  boom() {
    if (!this.ready('boom', 0.15)) return;
    this.tone(70, 0.7, 'sine', 0.8, 30);
    this.hiss(0.8, 400, 0.6, 0.6, 0, 'lowpass');
    this.hiss(0.3, 2500, 1, 0.2);
  }

  freeze() {
    if (!this.ready('freeze', 0.3)) return;
    [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, f * 1.01, i * 0.05));
    this.hiss(0.6, 7000, 2, 0.12);
  }

  shield() {
    if (!this.ready('shield', 0.3)) return;
    this.tone(440, 0.6, 'sine', 0.18, 880);
    this.tone(660, 0.6, 'triangle', 0.08, 1320, 0.05);
  }

  summon() {
    if (!this.ready('summon', 0.3)) return;
    this.tone(98, 0.8, 'sawtooth', 0.12, 196);
    this.tone(147, 0.8, 'sawtooth', 0.08, 98, 0.1);
  }

  volley() {
    if (!this.ready('volley', 0.2)) return;
    this.hiss(0.25, 3000, 1.2, 0.12);
    this.hiss(0.18, 2200, 1.2, 0.1, 0.06);
  }

  storm() {
    if (!this.ready('storm', 0.5)) return;
    this.whoosh();
    for (let i = 0; i < 8; i++) this.hiss(0.1, 2500 + Math.random() * 1500, 2, 0.1, 0.3 + i * 0.22);
  }

  horn() {
    if (!this.ready('horn', 0.5)) return;
    [196, 196, 261.6, 329.6].forEach((f, i) => this.tone(f, i === 3 ? 0.7 : 0.18, 'sawtooth', 0.12, undefined, i * 0.15));
  }

  treasure() {
    if (!this.ready('treasure', 0.5)) return;
    [1047, 1319, 1568, 2093, 1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.15, 'square', 0.07, undefined, i * 0.07));
  }

  skillReady() {
    if (!this.ready('skillReady', 0.5)) return;
    this.tone(880, 0.12, 'triangle', 0.15);
    this.tone(1320, 0.25, 'triangle', 0.15, undefined, 0.1);
  }

  click() {
    if (!this.ready('click', 0.03)) return;
    this.tone(660, 0.06, 'triangle', 0.15, 880);
  }

  win() {
    if (!this.ready('end', 1)) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.6 : 0.16, 'triangle', 0.22, undefined, i * 0.12));
  }

  lose() {
    if (!this.ready('end', 1)) return;
    [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.2));
  }

  /** Procedural music: each region has its own loop and boss fights switch to a tenser one. */
  setTrack(name: TrackName) {
    if (this.track === name) return;
    this.track = name;
    this.musicStep = 0;
    if (this.ctx) this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.05);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private drum(kind: 'kick' | 'snare' | 'hat', t0: number, vol: number) {
    const ctx = this.ctx!;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t0);
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(this.musicGain!);
      o.start(t0);
      o.stop(t0 + 0.2);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 6500 : 1800;
    const g = ctx.createGain();
    const len = kind === 'hat' ? 0.05 : 0.14;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(f).connect(g).connect(this.musicGain!);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + len + 0.02);
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || ctx.state !== 'running') return;
    const tr = TRACKS[this.track];
    const stepDur = 60 / tr.bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      const s = this.musicStep;
      const chord = tr.chords[Math.floor(s / 8) % tr.chords.length];
      const delay = Math.max(0, this.nextNoteTime - ctx.currentTime);
      const t0 = this.nextNoteTime;
      if (s % 4 === 0) this.tone(chord[0] / 2, stepDur * 1.8, 'triangle', 0.5, undefined, delay, this.musicGain);
      if (tr.bass8 && s % 2 === 1) this.tone(chord[0] / 2, stepDur * 0.8, 'triangle', 0.3, undefined, delay, this.musicGain);
      const idx = tr.pattern[s % tr.pattern.length];
      if (idx >= 0) {
        const note = chord[idx % 3] * (idx >= 3 ? 4 : 2);
        this.tone(note, stepDur * tr.sustain, tr.lead, tr.leadVol, undefined, delay, this.musicGain);
      }
      const beat = s % 8;
      if (tr.drums !== 'none') {
        if (s % 2 === 1) this.drum('hat', t0, 0.18);
        if (tr.drums === 'march' || tr.drums === 'heavy') {
          if (beat === 0 || beat === 4 || (tr.drums === 'heavy' && beat === 6)) this.drum('kick', t0, tr.drums === 'heavy' ? 0.9 : 0.6);
          if (beat === 2 || beat === 6) this.drum('snare', t0, 0.35);
        }
      }
      this.musicStep++;
      this.nextNoteTime += stepDur;
    }
  }
}

export type TrackName = 'river' | 'meadow' | 'snow' | 'desert' | 'volcano' | 'night' | 'boss';

interface Track {
  bpm: number;
  chords: number[][];
  /** chord tone per eighth note (3+ = an octave up, -1 = rest) */
  pattern: number[];
  lead: OscillatorType;
  leadVol: number;
  sustain: number;
  drums: 'none' | 'light' | 'march' | 'heavy';
  bass8?: boolean;
}

const TRACKS: Record<TrackName, Track> = {
  river: { bpm: 112, chords: [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]], pattern: [0, 1, 2, 1], lead: 'square', leadVol: 0.12, sustain: 0.9, drums: 'light' },
  meadow: { bpm: 124, chords: [[261.6, 329.6, 392], [174.6, 220, 261.6], [196, 246.9, 293.7], [220, 261.6, 329.6]], pattern: [0, 2, 1, 2, 3, 2, 1, 2], lead: 'triangle', leadVol: 0.22, sustain: 0.8, drums: 'march' },
  snow: { bpm: 92, chords: [[146.8, 174.6, 220], [116.5, 146.8, 174.6], [174.6, 220, 261.6], [130.8, 164.8, 196]], pattern: [0, 2, 4, 2, 1, -1, 3, -1], lead: 'sine', leadVol: 0.3, sustain: 1.6, drums: 'light' },
  desert: { bpm: 108, chords: [[164.8, 207.7, 246.9], [174.6, 220, 261.6], [164.8, 207.7, 246.9], [146.8, 174.6, 220]], pattern: [0, 1, 0, 2, 1, 0, 4, 2], lead: 'sawtooth', leadVol: 0.07, sustain: 0.7, drums: 'march' },
  volcano: { bpm: 132, chords: [[164.8, 196, 246.9], [130.8, 164.8, 196], [146.8, 185, 220], [123.5, 155.6, 185]], pattern: [0, 0, 2, 0, 1, 0, 2, 3], lead: 'sawtooth', leadVol: 0.07, sustain: 0.6, drums: 'heavy', bass8: true },
  night: { bpm: 84, chords: [[220, 261.6, 329.6], [174.6, 220, 261.6], [146.8, 174.6, 220], [164.8, 207.7, 246.9]], pattern: [0, -1, 2, -1, 4, -1, 1, -1], lead: 'triangle', leadVol: 0.25, sustain: 1.8, drums: 'none' },
  boss: { bpm: 144, chords: [[146.8, 174.6, 220], [116.5, 146.8, 174.6], [130.8, 164.8, 196], [110, 138.6, 164.8]], pattern: [0, 2, 1, 2, 3, 2, 1, 2], lead: 'square', leadVol: 0.1, sustain: 0.6, drums: 'heavy', bass8: true },
};

export const sfx = new Sfx();
