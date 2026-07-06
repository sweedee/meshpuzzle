/**
 * All sound is synthesized with WebAudio — no audio files shipped. The
 * AudioContext is created/resumed inside the first pointerdown gesture
 * (autoplay policy, especially iOS).
 */
export class SoundFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioScheduledSourceNode[] = [];
  private sfxOn: boolean;
  private ambientOn: boolean;

  constructor(settings: { sfx: boolean; ambient: boolean }) {
    this.sfxOn = settings.sfx;
    this.ambientOn = settings.ambient;
    document.addEventListener('pointerdown', this.unlock, { once: true, capture: true });
  }

  private unlock = (): void => {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return; // No audio support; every play call stays a no-op.
    }
    void this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.ctx.destination);
    if (this.ambientOn) this.startAmbient();
  };

  setSfx(on: boolean): void {
    this.sfxOn = on;
  }

  setAmbient(on: boolean): void {
    this.ambientOn = on;
    if (!this.ctx) return;
    if (on) this.startAmbient();
    else this.stopAmbient();
  }

  /** One oscillator with an exponential-decay envelope. */
  private blip(
    type: OscillatorType,
    freq: number,
    dur: number,
    vol: number,
    freqEnd?: number,
    delay = 0
  ): void {
    if (!this.ctx || !this.master || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Short filtered-noise click. */
  private click(vol = 0.25): void {
    if (!this.ctx || !this.master || !this.sfxOn) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.012);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(hp).connect(gain).connect(this.master);
    src.start(t0);
  }

  /** UI button press. */
  tap(): void {
    this.blip('triangle', 660, 0.045, 0.15);
  }

  /** Piece picked up. */
  grab(): void {
    this.blip('triangle', 330, 0.07, 0.18, 440);
  }

  /** Piece snapped home — the "thock". */
  snap(): void {
    this.blip('sine', 150, 0.13, 0.55, 60);
    this.click();
  }

  /** Released far from home. */
  deny(): void {
    this.blip('sine', 110, 0.08, 0.1, 90);
  }

  /** Win-screen star pop (n = 1..3). */
  star(n: number): void {
    const freqs = [880, 1108.7, 1318.5];
    this.blip('sine', freqs[Math.min(n, 3) - 1], 0.35, 0.22);
  }

  /** Win arpeggio over a soft pad. */
  fanfare(): void {
    if (!this.ctx || !this.master || !this.sfxOn) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => this.blip('triangle', f, 0.32, 0.2, undefined, i * 0.09));
    // Pad chord with a slow release under the arpeggio.
    const t0 = this.ctx.currentTime;
    for (const f of [261.63, 392]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0005, t0);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.8);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 1.9);
    }
  }

  /** Two detuned triangles through a lowpass, breathing via a slow LFO. */
  private startAmbient(): void {
    if (!this.ctx || !this.ambientGain || this.ambientNodes.length > 0) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(this.ambientGain);
    for (const f of [110, 165.3]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.detune.value = Math.random() * 8 - 4;
      osc.connect(lp);
      osc.start();
      this.ambientNodes.push(osc);
    }
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.008;
    lfo.connect(lfoGain).connect(this.ambientGain.gain);
    lfo.start();
    this.ambientNodes.push(lfo);
    this.ambientGain.gain.setValueAtTime(0.0005, this.ctx.currentTime);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.022, this.ctx.currentTime + 2);
  }

  private stopAmbient(): void {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.exponentialRampToValueAtTime(0.0005, this.ctx.currentTime + 0.6);
    const nodes = this.ambientNodes;
    this.ambientNodes = [];
    const stopAt = this.ctx.currentTime + 0.7;
    for (const n of nodes) n.stop(stopAt);
  }
}
