import type { Surface } from '../world/World';

type AudioCtor = typeof AudioContext;

const STEP: Record<Surface, { freq: number; q: number; gain: number; dur: number }> = {
  grass: { freq: 800, q: 0.7, gain: 0.16, dur: 0.1 },
  dirt: { freq: 600, q: 1.0, gain: 0.22, dur: 0.08 },
  site: { freq: 420, q: 1.1, gain: 0.26, dur: 0.08 },
  road: { freq: 2300, q: 1.6, gain: 0.11, dur: 0.05 },
};

/**
 * Zvuky syntetizované ve Web Audio – bez souborů, hra zůstane malá a offline.
 * Na mobilu musí AudioContext vzniknout z uživatelského gesta (tlačítko Začít).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.7 * this.volume;
    this.out.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.4);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  private engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

  /** Motor dodávky: dvě pily přes dolní propust, otáčky podle rychlosti. null = vypnout. */
  setEngine(speed: number | null): void {
    const c = this.ctx;
    if (!c || !this.out) return;
    if (speed === null) {
      if (this.engine) {
        const e = this.engine;
        e.gain.gain.setTargetAtTime(0, c.currentTime, 0.15);
        setTimeout(() => {
          e.osc.stop();
          e.osc2.stop();
        }, 700);
        this.engine = null;
      }
      return;
    }
    if (!this.engine) {
      const osc = c.createOscillator();
      const osc2 = c.createOscillator();
      osc.type = 'sawtooth';
      osc2.type = 'square';
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain).connect(this.out);
      osc.start();
      osc2.start();
      this.engine = { osc, osc2, gain, filter };
    }
    const e = this.engine;
    const rpm = 34 + Math.abs(speed) * 5.5; // volnoběh ~34 Hz
    e.osc.frequency.setTargetAtTime(rpm, c.currentTime, 0.1);
    e.osc2.frequency.setTargetAtTime(rpm * 0.5, c.currentTime, 0.1);
    e.filter.frequency.setTargetAtTime(300 + Math.abs(speed) * 40, c.currentTime, 0.1);
    e.gain.gain.setTargetAtTime(0.05 + Math.min(Math.abs(speed), 14) * 0.004, c.currentTime, 0.1);
  }

  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private ambT = 2;
  private ambClock = 0;

  /** Zvuky okolí: vítr, ptáci / stavební ruch, v noci cvrčci. Volat každý snímek. */
  private rainGain: GainNode | null = null;
  private volume = 0.8;
  ambienceOn = true;

  setVolume(v: number): void {
    this.volume = v;
    if (this.out) this.out.gain.value = 0.7 * v;
  }

  ambience(dt: number, place: 'kancelar' | 'stavba' | 'louka' | 'les', night: number, inside: boolean, weather = { wind: 0.25, rain: 0 }): void {
    const c = this.ctx;
    if (!c || !this.out || !this.noise || c.state !== 'running') return;
    if (!this.ambienceOn) {
      this.wind?.gain.gain.setTargetAtTime(0, c.currentTime, 0.3);
      this.rainGain?.gain.setTargetAtTime(0, c.currentTime, 0.3);
      return;
    }
    this.ambClock += dt;
    if (!this.wind) {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.6;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.out);
      src.start();
      this.wind = { gain, filter };
    }
    const gust = 0.5 + 0.5 * Math.sin(this.ambClock * 0.23) * Math.sin(this.ambClock * 0.071 + 1);
    const windK = 0.5 + weather.wind * 1.8;
    this.wind.gain.gain.setTargetAtTime(inside ? 0.004 : (0.01 + gust * 0.022) * windK, c.currentTime, 0.8);
    // Déšť: šum přes horní propust (na střeše dodávky tlumeně).
    if (!this.rainGain) {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      this.rainGain = c.createGain();
      this.rainGain.gain.value = 0;
      src.connect(hp).connect(this.rainGain).connect(this.out);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(weather.rain * (inside ? 0.02 : 0.045), c.currentTime, 1);
    if (weather.rain > 0.5 && !inside) return; // v dešti ptáci nezpívají
    this.wind.filter.frequency.setTargetAtTime(300 + gust * 380, c.currentTime, 0.8);

    this.ambT -= dt;
    if (this.ambT > 0 || inside) return;
    this.ambT = 1.2 + Math.random() * 4;
    if (night > 0.6) {
      // cvrčci: rychlé trylky
      for (let i = 0; i < 6; i++) setTimeout(() => this.tone(4300, 4400, 0.012, 0.035, 'sine'), i * 55);
      return;
    }
    if (place === 'stavba' && Math.random() < 0.65) {
      if (Math.random() < 0.3) {
        // couvající technika v dálce
        for (let i = 0; i < 3; i++) setTimeout(() => this.tone(1050, 1050, 0.012, 0.18, 'square'), i * 420);
      } else {
        // cinknutí kovu o kov
        this.tone(1800 + Math.random() * 900, 1500, 0.03, 0.09, 'triangle');
        setTimeout(() => this.tone(2600, 2300, 0.015, 0.12, 'sine'), 30);
      }
      return;
    }
    if (place === 'les' && Math.random() < 0.4) {
      if (Math.random() < 0.55) {
        // datel: rychlé bubnování do kmene
        for (let i = 0; i < 14; i++) setTimeout(() => this.burst(700 + Math.random() * 200, 3, 0.05 * (1 - i / 20), 0.018), i * 48);
      } else {
        // kukačka v dálce
        this.tone(660, 650, 0.03, 0.22, 'sine');
        setTimeout(() => this.tone(540, 530, 0.03, 0.3, 'sine'), 260);
      }
      return;
    }
    // ptáci: dva až čtyři krátké cvrkoty
    const base = 2600 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) setTimeout(() => this.tone(base, base * (1.15 + Math.random() * 0.3), 0.022, 0.07, 'sine'), i * (90 + Math.random() * 60));
  }

  step(surface: Surface): void {
    const p = STEP[surface];
    this.burst(p.freq * (0.85 + Math.random() * 0.3), p.q, p.gain * (0.8 + Math.random() * 0.4), p.dur);
  }

  pickup(): void {
    this.burst(1500, 2, 0.12, 0.04);
    this.tone(210, 120, 0.12, 0.14, 'triangle');
  }

  drop(): void {
    this.burst(300, 0.9, 0.3, 0.12);
    this.tone(95, 60, 0.18, 0.16, 'sine');
  }

  click(): void {
    this.tone(1400, 1100, 0.05, 0.03, 'square');
  }

  /** Servomotory robotické stanice. */
  servo(dur = 0.6): void {
    this.tone(180, 320, 0.05, dur, 'sawtooth');
  }

  /** Ztráta zámku: dvojité pípnutí dolů. */
  lost(): void {
    this.tone(880, 440, 0.08, 0.14, 'square');
    setTimeout(() => this.tone(660, 330, 0.08, 0.16, 'square'), 170);
  }

  success(): void {
    this.tone(660, 660, 0.08, 0.12, 'triangle');
    setTimeout(() => this.tone(990, 990, 0.08, 0.18, 'triangle'), 110);
  }

  private burst(freq: number, q: number, gain: number, dur: number): void {
    const c = this.ctx;
    if (!c || !this.out || !this.noise || c.state !== 'running') return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.3, dur + 0.02);
  }

  private tone(f0: number, f1: number, gain: number, dur: number, type: OscillatorType): void {
    const c = this.ctx;
    if (!c || !this.out || c.state !== 'running') return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
