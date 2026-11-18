/**
 * Film sound, synthesized live with the Web Audio API: no audio files, so
 * nothing to license or download. Off by default; browsers only allow audio
 * after a click or key press, so the nav's sound toggle turns it on.
 *
 * Scenes call the one-shots (`slash`, `ignite`, `thunder`, `drum`) at the
 * moment the matching visual happens, and set continuous layers
 * (`water`, `flame`, `wind`) to a level between 0 and 1 while their scene is
 * on screen. Every call is a no-op while sound is off.
 */

type Layer = "water" | "flame" | "wind";
const LAYERS: Layer[] = ["water", "flame", "wind"];
const STORAGE_KEY = "film_sound";

interface LayerNodes {
  gain: GainNode;
  owners: Map<string, number>;
}

class FilmAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private layers = new Map<Layer, LayerNodes>();
  private crackleTimer = 0;
  private volume = 0.6;
  private on = false;
  private listeners = new Set<(on: boolean) => void>();

  get enabled() {
    return this.on;
  }

  /** The visitor's saved choice (sound still needs a click to actually start). */
  get preferred(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      return false;
    }
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.on ? this.volume : 0, this.ctx.currentTime, 0.1);
  }

  subscribe(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Must be called from a click or key handler (browser autoplay rules). */
  async enable() {
    if (!this.ctx) this.build();
    if (!this.ctx || !this.master) return;
    await this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.15);
    this.save("on");
    this.emit();
  }

  disable() {
    this.on = false;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      const ctx = this.ctx;
      window.setTimeout(() => !this.on && ctx.suspend(), 400);
    }
    this.save("off");
    this.emit();
  }

  // ---------------------------------------------------------------- layers

  /** Set a continuous layer's level for one owner (a scene); the loudest owner wins. */
  setLayer(layer: Layer, owner: string, level: number) {
    const l = this.layers.get(layer);
    if (!l || !this.ctx) return;
    const v = Math.min(1, Math.max(0, level));
    if (v <= 0.001) l.owners.delete(owner);
    else l.owners.set(owner, v);
    const target = Math.max(0, ...l.owners.values());
    const peak = layer === "water" ? 0.32 : layer === "flame" ? 0.26 : 0.2;
    l.gain.gain.setTargetAtTime(target * peak, this.ctx.currentTime, 0.25);
  }

  // ------------------------------------------------------------- one-shots

  /** A katana cut: an air swoosh sweeping left to right with a ringing steel tail. */
  slash(intensity = 1) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const src = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.38);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * intensity, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.8, t);
    pan.pan.linearRampToValueAtTime(0.8, t + 0.35);
    src.connect(bp).connect(g).connect(pan).connect(this.master);
    src.start(t);
    src.stop(t + 0.45);
    // the ring of the blade
    for (const [f, a] of [[3150, 0.07], [4730, 0.045], [6280, 0.025]] as const) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t + 0.05);
      og.gain.exponentialRampToValueAtTime(a * intensity, t + 0.07);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(og).connect(pan);
      o.start(t + 0.05);
      o.stop(t + 0.95);
    }
  }

  /** A lantern catching: a soft low whoomp. */
  ignite(intensity = 1) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const src = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * intensity, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
  }

  /** A lightning strike: a sharp crack, then a long low rumble. */
  thunder(intensity = 1) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const crack = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.7 * intensity, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    crack.connect(hp).connect(cg).connect(this.master);
    crack.start(t);
    crack.stop(t + 0.16);
    const rumble = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 140;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.9 * intensity, t + 0.12);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    rumble.connect(lp).connect(rg).connect(this.master);
    rumble.start(t);
    rumble.stop(t + 2.5);
  }

  /** A taiko-style drum hit, for the sound rings. */
  drum(intensity = 1) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85 * intensity, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.75);
    const skin = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.25 * intensity, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    skin.connect(bp).connect(sg).connect(this.master);
    skin.start(t);
    skin.stop(t + 0.06);
  }

  // ------------------------------------------------------------- internals

  private ready(): AudioContext | null {
    return this.on && this.ctx && this.ctx.state === "running" ? this.ctx : null;
  }

  private noiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random() * 1.5;
    return src;
  }

  private build() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    for (const layer of LAYERS) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.master);
      const src = this.noiseSource();
      const f = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      if (layer === "water") {
        // rushing water: low-passed noise whose brightness rolls like waves
        f.type = "lowpass";
        f.frequency.value = 900;
        lfo.frequency.value = 0.18;
        depth.gain.value = 500;
      } else if (layer === "flame") {
        // the roar of a fire; crackles are added on top by a timer
        f.type = "lowpass";
        f.frequency.value = 380;
        lfo.frequency.value = 0.6;
        depth.gain.value = 120;
      } else {
        // night wind / mist
        f.type = "bandpass";
        f.frequency.value = 560;
        f.Q.value = 0.8;
        lfo.frequency.value = 0.07;
        depth.gain.value = 260;
      }
      lfo.connect(depth).connect(f.frequency);
      src.connect(f).connect(gain);
      src.start();
      lfo.start();
      this.layers.set(layer, { gain, owners: new Map() });
    }

    // fire crackle: short bright pops, as dense as the flame layer is loud
    this.crackleTimer = window.setInterval(() => {
      const flame = this.layers.get("flame");
      const level = flame ? Math.max(0, ...flame.owners.values()) : 0;
      if (!this.ready() || level < 0.05) return;
      for (let i = 0; i < 3; i++) if (Math.random() < level * 0.5) this.pop(level, i * 0.03);
    }, 90);
  }

  private pop(level: number, delay: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const src = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2000 + Math.random() * 3000;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25 * level * Math.random(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.03);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.06);
  }

  private save(v: "on" | "off") {
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  private emit() {
    for (const fn of this.listeners) fn(this.on);
  }
}

/** One shared instance for the whole page. */
export const filmAudio = new FilmAudio();

/** Calls `fn` once when `value` crosses `threshold` going up (for one-shot sounds tied to scroll). */
export function crossingUp() {
  let prev = 0;
  return (value: number, threshold: number, fn: () => void) => {
    if (prev < threshold && value >= threshold) fn();
    prev = value;
  };
}
