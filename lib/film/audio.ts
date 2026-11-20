/**
 * Film sound, synthesized live with the Web Audio API: no audio files, so
 * nothing to license or download. Browsers only allow audio after a click,
 * tap or key press, so sound that is "on" starts at the visitor's first one;
 * the nav's toggle turns it off (remembered) or back on.
 *
 * Scenes call the one-shots (`slash`, `ignite`, `thunder`, `drum`) at the
 * moment the matching visual happens, and set continuous layers
 * (`water`, `flame`, `wind`, `leaves`) to a level between 0 and 1 while their scene is
 * on screen. `setMusic` fades a looping track in and out the same way.
 * With a hold time set (site.json `sound.holdSeconds`), each scene's sound plays
 * only that long after the scene arrives, then fades, until the scene comes back.
 * Every call is a no-op while sound is off.
 */

type Layer = "water" | "flame" | "wind" | "leaves";
const LAYERS: Layer[] = ["water", "flame", "wind", "leaves"];
const PEAK: Record<Layer, number> = { water: 0.32, flame: 0.26, wind: 0.2, leaves: 0.16 };
const STORAGE_KEY = "film_sound";

interface LayerNodes {
  gain: GainNode;
  owners: Map<string, number>;
  /** when each owner started sounding, for the hold time */
  since: Map<string, number>;
}

class FilmAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private layers = new Map<Layer, LayerNodes>();
  private crackleTimer = 0;
  private rustleTimer = 0;
  private music: { src: string; el: HTMLAudioElement; gain: GainNode; level: number; stopTimer: number; holdTimer: number } | null = null;
  private holdMs = 0;
  private volume = 0.6;
  private on = false;
  private defaultOn = false;
  private listeners = new Set<(on: boolean) => void>();

  get enabled() {
    return this.on;
  }

  /** Whether sound should be on: the visitor's saved choice, else the site's default. */
  get preferred(): boolean {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? saved === "on" : this.defaultOn;
    } catch {
      return this.defaultOn;
    }
  }

  /** The site's default when the visitor hasn't chosen (site.json `sound.defaultOn`). */
  setDefaultOn(v: boolean) {
    this.defaultOn = v;
  }

  /** How long a scene's sound plays once the scene arrives (0 = for as long as it is on screen). */
  setHold(seconds: number) {
    this.holdMs = Math.max(0, seconds) * 1000;
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
    if (v <= 0.001) {
      l.owners.delete(owner);
      l.since.delete(owner);
    } else {
      l.owners.set(owner, v);
      if (!l.since.has(owner)) {
        l.since.set(owner, performance.now());
        // fade out once the hold time is up, even if the scene stops calling
        if (this.holdMs) window.setTimeout(() => this.apply(layer), this.holdMs + 20);
      }
    }
    this.apply(layer);
  }

  /** A layer's level now: its loudest owner still inside the hold time. */
  private level(layer: Layer): number {
    const l = this.layers.get(layer);
    if (!l) return 0;
    const now = performance.now();
    let top = 0;
    for (const [owner, v] of l.owners) {
      const since = l.since.get(owner) ?? now;
      if (!this.holdMs || now - since < this.holdMs) top = Math.max(top, v);
    }
    return top;
  }

  private apply(layer: Layer) {
    const l = this.layers.get(layer);
    if (!l || !this.ctx) return;
    l.gain.gain.setTargetAtTime(this.level(layer) * PEAK[layer], this.ctx.currentTime, 0.25);
  }

  /**
   * Fade a looping track (a path under public/) to `level` (0..1). It runs through the
   * master gain, so the sound toggle mutes it too; at 0 it pauses once faded out.
   * Cheap to call every frame: nothing happens unless the level changes.
   */
  setMusic(src: string, level: number, holdSeconds?: number) {
    const holdMs = holdSeconds === undefined ? this.holdMs : Math.max(0, holdSeconds) * 1000;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const v = Math.min(1, Math.max(0, level));
    if (!this.music || this.music.src !== src) {
      if (v <= 0.001) return;
      this.music?.el.pause();
      const el = new Audio(src);
      el.loop = true;
      el.preload = "auto";
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(this.master);
      this.music = { src, el, gain, level: 0, stopTimer: 0, holdTimer: 0 };
    }
    const m = this.music;
    if (Math.abs(m.level - v) < 0.001) return;
    const arriving = m.level <= 0.001 && v > 0;
    m.level = v;
    window.clearTimeout(m.stopTimer);
    if (v <= 0.001) window.clearTimeout(m.holdTimer);
    // a slow fade when the hold time runs out, a quicker one when the visitor scrolls away
    const fadeOut = (slow: boolean) => {
      m.gain.gain.setTargetAtTime(0, ctx.currentTime, slow ? 1.4 : 0.5);
      m.stopTimer = window.setTimeout(() => m.el.pause(), slow ? 7000 : 2500);
    };
    if (v > 0) {
      // a quick swell in; with a hold time it plays that long, then fades
      m.gain.gain.setTargetAtTime(v, ctx.currentTime, holdMs ? 0.3 : 1.2);
      if (arriving) {
        m.el.currentTime = 0;
        if (holdMs) m.holdTimer = window.setTimeout(() => fadeOut(true), holdMs);
      }
      if (m.el.paused) void m.el.play().catch(() => undefined);
    } else {
      fadeOut(false);
    }
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
    g.gain.exponentialRampToValueAtTime(0.4 * intensity, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.75);
    const skin = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.12 * intensity, t);
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
      } else if (layer === "leaves") {
        // leaves in a breeze: only the airy top of the noise, swelling slowly; rustles are added by a timer
        f.type = "highpass";
        f.frequency.value = 2600;
        lfo.frequency.value = 0.11;
        depth.gain.value = 900;
      } else {
        // night wind / mist
        f.type = "bandpass";
        f.frequency.value = 560;
        f.Q.value = 0.8;
        lfo.frequency.value = 0.07;
        depth.gain.value = 260;
      }
      lfo.connect(depth).connect(f.frequency);
      if (layer === "leaves") {
        // soften the hiss and let it breathe in gusts
        const soft = ctx.createBiquadFilter();
        soft.type = "lowpass";
        soft.frequency.value = 5200;
        const gust = ctx.createGain();
        gust.gain.value = 0.7;
        const gustLfo = ctx.createOscillator();
        gustLfo.frequency.value = 0.17;
        const gustDepth = ctx.createGain();
        gustDepth.gain.value = 0.3;
        gustLfo.connect(gustDepth).connect(gust.gain);
        gustLfo.start();
        src.connect(f).connect(soft).connect(gust).connect(gain);
      } else {
        src.connect(f).connect(gain);
      }
      src.start();
      lfo.start();
      this.layers.set(layer, { gain, owners: new Map(), since: new Map() });
    }

    // fire crackle: short bright pops, as dense as the flame layer is loud
    this.crackleTimer = window.setInterval(() => {
      const level = this.level("flame");
      if (!this.ready() || level < 0.05) return;
      for (let i = 0; i < 3; i++) if (Math.random() < level * 0.5) this.pop(level, i * 0.03);
    }, 90);

    // leaf rustles: soft, short brushes of high noise, as frequent as the leaves layer is loud
    this.rustleTimer = window.setInterval(() => {
      const level = this.level("leaves");
      if (!this.ready() || level < 0.05) return;
      if (Math.random() < level * 0.4) this.rustle(level);
    }, 260);
  }

  private rustle(level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const len = 0.12 + Math.random() * 0.25;
    const src = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200 + Math.random() * 2600;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03 * level * (0.5 + Math.random() * 0.5), t + len * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + len + 0.02);
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
