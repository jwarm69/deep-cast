import { Component, Events } from '../core/types';
import { EventSystem } from '../core/EventSystem';

/**
 * Synthesized sound effects via Web Audio API — no external files.
 * AudioContext is created lazily on first user interaction.
 */
export class SoundSystem implements Component {
  private events: EventSystem;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reelOsc: OscillatorNode | null = null;
  private reelGain: GainNode | null = null;
  private isReeling = false;

  constructor(events: EventSystem) {
    this.events = events;
  }

  init(): void {
    this.events.on(Events.CAST_START, () => this.castCharge());
    this.events.on(Events.CAST_RELEASE, () => this.castWhoosh());
    this.events.on(Events.BOBBER_LAND, () => this.splash());
    this.events.on(Events.FISH_BITE, () => this.biteAlert());
    this.events.on(Events.REEL_START, () => this.startReel());
    this.events.on(Events.FISH_CAUGHT, () => {
      this.stopReel();
      this.catchFanfare();
    });
    this.events.on(Events.FISH_ESCAPED, () => {
      this.stopReel();
      this.escapeFail();
    });
    this.events.on(Events.LEVEL_UP, () => this.levelUp());
    this.events.on(Events.EQUIPMENT_PURCHASED, () => this.coinSound());
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Primitives ---

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0): void {
    const ctx = this.ensure();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }

  private noise(duration: number, filterFreq: number, filterType: BiquadFilterType = 'lowpass', vol = 0.2, delay = 0): void {
    const ctx = this.ensure();
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  // --- Sound effects ---

  private castCharge(): void {
    // Subtle rising tone
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 1.6);
  }

  private castWhoosh(): void {
    this.noise(0.25, 3000, 'highpass', 0.12);
    this.noise(0.15, 1500, 'bandpass', 0.08);
  }

  private splash(): void {
    this.noise(0.35, 600, 'lowpass', 0.2);
    this.noise(0.15, 1200, 'lowpass', 0.1, 0.05);
    // Low thud
    this.tone(80, 0.2, 'sine', 0.15);
  }

  private biteAlert(): void {
    this.tone(880, 0.08, 'sine', 0.25);
    this.tone(1100, 0.12, 'sine', 0.3, 0.1);
  }

  private startReel(): void {
    if (this.isReeling) return;
    const ctx = this.ensure();
    this.isReeling = true;

    // Continuous reel hum
    this.reelOsc = ctx.createOscillator();
    this.reelGain = ctx.createGain();
    this.reelOsc.type = 'sawtooth';
    this.reelOsc.frequency.setValueAtTime(120, ctx.currentTime);
    this.reelGain.gain.setValueAtTime(0.06, ctx.currentTime);
    this.reelOsc.connect(this.reelGain);
    this.reelGain.connect(this.master);
    this.reelOsc.start();
  }

  /** Call each frame while reeling to modulate pitch with progress */
  updateReelPitch(progress: number): void {
    if (this.reelOsc && this.reelGain) {
      this.reelOsc.frequency.value = 120 + progress * 200;
      this.reelGain.gain.value = 0.04 + progress * 0.06;
    }
  }

  private stopReel(): void {
    if (!this.isReeling) return;
    this.isReeling = false;
    try {
      this.reelOsc?.stop();
      this.reelOsc?.disconnect();
      this.reelGain?.disconnect();
    } catch { /* already stopped */ }
    this.reelOsc = null;
    this.reelGain = null;
  }

  private catchFanfare(): void {
    // C5 → E5 → G5 → C6 ascending arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this.tone(freq, 0.3, 'sine', 0.2, i * 0.1);
      this.tone(freq * 0.5, 0.3, 'triangle', 0.08, i * 0.1); // sub-octave warmth
    });
  }

  private levelUp(): void {
    // G5 → B5 → D6 → G6 bright ascending
    const notes = [784, 988, 1175, 1568];
    notes.forEach((freq, i) => {
      this.tone(freq, 0.35, 'triangle', 0.2, i * 0.12);
    });
    // Shimmer
    this.noise(0.6, 4000, 'highpass', 0.04, 0.3);
  }

  private escapeFail(): void {
    this.tone(330, 0.2, 'sine', 0.15);
    this.tone(262, 0.35, 'sine', 0.15, 0.18);
  }

  private coinSound(): void {
    this.tone(1319, 0.08, 'sine', 0.15); // E6
    this.tone(1568, 0.15, 'sine', 0.15, 0.07); // G6
  }

  update(_dt: number): void {}

  destroy(): void {
    this.stopReel();
    this.ctx?.close();
  }
}
