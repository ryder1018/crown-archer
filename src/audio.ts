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

  roar() {
    if (!this.ready('roar', 1)) return;
    this.tone(110, 0.8, 'sawtooth', 0.18, 70);
    this.tone(82, 0.9, 'sawtooth', 0.12, 55);
  }

  coin() {
    if (!this.ready('coin', 0.06)) return;
    this.tone(988, 0.07, 'square', 0.08);
    this.tone(1319, 0.2, 'square', 0.08, undefined, 0.07);
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

  /** A light marching loop: bass + plucked arpeggio, scheduled ahead with the audio clock. */
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || ctx.state !== 'running') return;
    const stepDur = 60 / 112 / 2;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      const s = this.musicStep;
      const chord = chords[Math.floor(s / 8) % chords.length];
      const delay = Math.max(0, this.nextNoteTime - ctx.currentTime);
      if (s % 4 === 0) this.tone(chord[0] / 2, stepDur * 1.8, 'triangle', 0.5, undefined, delay, this.musicGain);
      const note = chord[[0, 1, 2, 1][s % 4]] * 2;
      this.tone(note, stepDur * 0.9, 'square', 0.12, undefined, delay, this.musicGain);
      if (s % 2 === 1) {
        const t0 = this.nextNoteTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        src.connect(f).connect(g).connect(this.musicGain);
        src.start(t0);
        src.stop(t0 + 0.06);
      }
      this.musicStep++;
      this.nextNoteTime += stepDur;
    }
  }
}

export const sfx = new Sfx();
