/**
 * skate-moves.ts — define individual tricks and compose them into a run.
 *
 * Lifelike motion comes from:
 *   1. Asymmetric gravity: fall accelerates, rise decelerates.
 *   2. Overlap: hips lead, shoulders lag, head lags more, arms trail.
 *   3. Anticipation: body winds down before exploding up.
 *   4. Follow-through: limbs continue past the body's settled pose.
 *   5. Active air pose: tuck at apex, extend reaching for the ground.
 *
 * The state shape encodes these as separate channels so the renderer
 * can drive each body part on its own clock.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FrameState {
  // Body height & ground contact
  /** Hip height above ground in pixels. The dominant vertical channel. */
  jh: number;
  /** Crouch amount 0-1. Compresses the legs/hips toward the ground. */
  crouch: number;

  // Spine chain (separated for overlap)
  /** Forward/back torso lean in radians. Positive = leaning forward. */
  torsoLean: number;
  /** Head tilt in radians, lagging the torso for follow-through. */
  headTilt: number;
  /** Spine twist about the vertical axis in radians (for shuv counter-rotation). */
  spineTwist: number;

  // Arms (split L/R so they can swing independently)
  /** Left arm raise 0-1 (0 = down at side, 1 = overhead). */
  armL: number;
  /** Right arm raise 0-1. */
  armR: number;
  /** Combined spread, kept for backwards compatibility with old renderers. */
  arms: number;

  // Board
  /** Kickflip rotation in radians (cos-scales board width in renderer). */
  boardKickflip: number;
  /** Shuvit rotation in radians (in-plane spin). */
  boardShuv: number;

  // Special poses
  /** Handstand inversion 0-1. */
  handstand: number;
}

export interface Move {
  duration: number;
  label: string;
  getState(t: number): FrameState;
}

export interface Sequence {
  duration: number;
  getState(frame: number): FrameState;
}

// ── Constants & helpers ──────────────────────────────────────────────────────

const MAX_JH = 110;

const ZERO: FrameState = {
  jh: 0, crouch: 0,
  torsoLean: 0, headTilt: 0, spineTwist: 0,
  armL: 0, armR: 0, arms: 0,
  boardKickflip: 0, boardShuv: 0,
  handstand: 0,
};

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Asymmetric jump arc: real gravity. Rise is decelerating (ease-out),
 * fall is accelerating (ease-in), with a brief float at apex.
 *
 * Old version used pure sin — symmetric up and down, dead-fish feel.
 */
function gravityArc(t: number, airStart: number, airEnd: number, height = MAX_JH): number {
  if (t <= airStart || t >= airEnd) return 0;
  const u = (t - airStart) / (airEnd - airStart); // 0..1 across air phase
  // Apex sits at u = 0.45 (slightly before midpoint — pop is fast, fall is slower-starting)
  const apex = 0.45;
  if (u < apex) {
    // Rising: decelerate. v ∈ [0,1], peak at 1.
    const v = u / apex;
    return (1 - Math.pow(1 - v, 2.2)) * height;
  } else {
    // Falling: accelerate. v ∈ [0,1], drops from 1 to 0.
    const v = (u - apex) / (1 - apex);
    return (1 - Math.pow(v, 1.8)) * height;
  }
}

/**
 * Crouch profile with anticipation and active air pose.
 * - Pre-pop: deep wind-down (anticipation).
 * - Rising: extends (legs push off — crouch drops to ~0).
 * - Apex: tucks knees up (crouch climbs to ~0.9).
 * - Falling: extends reaching for ground (crouch drops to ~0.2).
 * - Landing: deep absorption then recovery.
 */
function activeCrouch(
  t: number,
  windStart: number, airStart: number, airEnd: number, landEnd: number,
): number {
  // Anticipation: wind down to deep crouch before pop
  if (t >= windStart && t < airStart) {
    const u = (t - windStart) / (airStart - windStart);
    return easeInOut(u);                                // 0 → 1
  }
  // Air phase: extend on rise, tuck at apex, extend on fall
  if (t >= airStart && t <= airEnd) {
    const u = (t - airStart) / (airEnd - airStart);    // 0..1
    if (u < 0.25)        return lerp(1, 0.1, u / 0.25);          // legs push off
    if (u < 0.6)         return lerp(0.1, 0.9, (u - 0.25) / 0.35); // tuck up
    return lerp(0.9, 0.2, (u - 0.6) / 0.4);            // reach for ground
  }
  // Landing absorption + recovery
  if (t > airEnd && t <= landEnd) {
    const u = (t - airEnd) / (landEnd - airEnd);
    // Hits 1 quickly (impact), then releases (recovery)
    return u < 0.35
      ? lerp(0.2, 1, u / 0.35)
      : lerp(1, 0, (u - 0.35) / 0.65);
  }
  return 0;
}

/** Generic delay-and-follow channel: input curve shifted later in time. */
function lag(t: number, fn: (t: number) => number, delay: number): number {
  return fn(clamp(t - delay));
}

// ── Moves ─────────────────────────────────────────────────────────────────────

/** Plain rolling — deep crouch, arms out for balance, slight forward lean. */
export function roll(duration = 40): Move {
  return {
    duration,
    label: 'roll',
    getState(t) {
      return {
        ...ZERO,
        crouch: 0.72,
        torsoLean: 0.18,
        headTilt: 0.10,
        armL: 0.22 + Math.sin(t * Math.PI * 2) * 0.06,
        armR: 0.22 - Math.sin(t * Math.PI * 2) * 0.06,
      };
    },
  };
}

/**
 * Standard ollie with anticipation, asymmetric arc, follow-through.
 * Air phase 0.12 → 0.82; the rest is wind-up and landing recovery.
 */
export const ollie: Move = {
  duration: 38,
  label: 'ollie',
  getState(t) {
    const jh = gravityArc(t, 0.12, 0.82);
    const cr = activeCrouch(t, 0, 0.12, 0.82, 1);
    const inAir = t > 0.12 && t < 0.82;
    const airU  = inAir ? (t - 0.12) / 0.70 : 0;        // 0..1 across air phase

    // Arms swing up for momentum on the pop, peak at apex, drop on landing.
    // Slight L/R asymmetry — one arm leads (lead foot side).
    const armCurve = inAir ? Math.sin(airU * Math.PI) : 0;
    const armL = armCurve * 0.95;
    const armR = lag(t, x => {
      const u = (x - 0.12) / 0.70;
      return u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0;
    }, 0.04) * 0.85;

    // Torso leans forward into the pop, back at apex (counter-balance), forward on landing.
    const torsoLean =
      t < 0.12 ? 0.08 + (t / 0.12) * 0.18 :              // wind into pop
      inAir    ? lerp(0.26, -0.10, airU) :               // arch back at apex
      0.15 * (1 - clamp((t - 0.82) / 0.18));             // settle on landing

    // Head lags the torso slightly (overlap).
    const headTilt = lag(t, x =>
      x < 0.12 ? 0.08 + (x / 0.12) * 0.18 :
      x > 0.12 && x < 0.82 ? lerp(0.26, -0.10, (x - 0.12) / 0.70) :
      0.15 * (1 - clamp((x - 0.82) / 0.18)),
    0.05);

    return {
      ...ZERO,
      jh, crouch: cr,
      torsoLean, headTilt,
      armL, armR,
      arms: Math.max(armL, armR),                        // back-compat
    };
  },
};

/** Kickflip: ollie mechanics + board flips 360° on its long axis. */
export const kickflip: Move = {
  duration: 42,
  label: 'kickflip',
  getState(t) {
    const base = ollie.getState(t);
    // Flick happens just after the pop, completes before landing.
    const flipT = clamp((t - 0.18) / 0.58);
    // Ease the flip so most rotation happens mid-air, not at the boundaries.
    const flipEased = easeInOut(flipT);
    return {
      ...base,
      boardKickflip: flipEased * Math.PI * 2,
      // Body twists slightly with the flick of the lead foot
      spineTwist: Math.sin(flipT * Math.PI) * 0.15,
    };
  },
};

/** 360 shuvit: board spins horizontally, body counter-rotates for balance. */
export const shuvit: Move = {
  duration: 38,
  label: 'shuvit',
  getState(t) {
    const base = ollie.getState(t);
    const shuvT = clamp((t - 0.14) / 0.62);
    const shuvEased = easeInOut(shuvT);
    return {
      ...base,
      // Slightly lower jump than a kickflip — shuv is a flatter trick
      jh: gravityArc(t, 0.12, 0.82, MAX_JH * 0.78),
      boardShuv: shuvEased * Math.PI * 2,
      // Body counter-rotates against the board (opposite direction, ~⅓ magnitude)
      spineTwist: -shuvEased * Math.PI * 0.6,
    };
  },
};

/** Handstand: rotates onto hands, holds, recovers. */
export const handstand: Move = {
  duration: 56,
  label: 'handstand',
  getState(t) {
    // Rise/fall use easeOutBack for a tiny overshoot — the wobble of balancing.
    const inv =
      t < 0.25 ? easeOutBack(t / 0.25) :
      t > 0.78 ? easeOutBack((1 - t) / 0.22) :
      1 + Math.sin(t * Math.PI * 8) * 0.015;             // micro-wobble while held

    // Subtle hand-balancing sway in the spine while inverted
    const sway = t > 0.25 && t < 0.78 ? Math.sin(t * Math.PI * 6) * 0.04 : 0;

    return {
      ...ZERO,
      handstand: clamp(inv),
      spineTwist: sway,
      // Crouch slightly during entry/exit for the kick-up motion
      crouch: t < 0.15 ? easeInOut(t / 0.15) * 0.6 :
              t > 0.85 ? easeInOut((1 - t) / 0.15) * 0.6 : 0,
    };
  },
};

// ── Composer with cross-fade ─────────────────────────────────────────────────

const BLEND_FRAMES = 6;

/**
 * Chain moves into a single Sequence with short cross-fades between them
 * to eliminate the snap when one move's end pose differs from the next
 * move's start pose. BLEND_FRAMES controls the overlap (6 ≈ 100ms at 60fps).
 */
export function compose(...moves: Move[]): Sequence {
  const durations = moves.map(m => m.duration);
  const total     = durations.reduce((s, d) => s + d, 0);

  // Pre-compute frame offsets for each move
  const offsets: number[] = [];
  let acc = 0;
  for (const d of durations) { offsets.push(acc); acc += d; }

  return {
    duration: total,
    getState(frame: number): FrameState {
      const f = Math.min(frame, total - 1);

      // Find current move
      let idx = 0;
      for (let i = 0; i < moves.length; i++) {
        if (f < offsets[i] + durations[i]) { idx = i; break; }
      }

      const localF = f - offsets[idx];
      const d      = durations[idx];
      const state  = moves[idx].getState(localF / d);

      // Cross-fade into next move if we're near the boundary
      const framesUntilEnd = d - localF;
      if (framesUntilEnd < BLEND_FRAMES && idx < moves.length - 1) {
        const next = moves[idx + 1].getState(0);
        const blend = 1 - framesUntilEnd / BLEND_FRAMES;
        return blendStates(state, next, easeInOut(blend));
      }

      return state;
    },
  };
}

/** Linearly interpolate every numeric field of two states. */
function blendStates(a: FrameState, b: FrameState, t: number): FrameState {
  return {
    jh:            lerp(a.jh,            b.jh,            t),
    crouch:        lerp(a.crouch,        b.crouch,        t),
    torsoLean:     lerp(a.torsoLean,     b.torsoLean,     t),
    headTilt:      lerp(a.headTilt,      b.headTilt,      t),
    spineTwist:    lerp(a.spineTwist,    b.spineTwist,    t),
    armL:          lerp(a.armL,          b.armL,          t),
    armR:          lerp(a.armR,          b.armR,          t),
    arms:          lerp(a.arms,          b.arms,          t),
    boardKickflip: lerp(a.boardKickflip, b.boardKickflip, t),
    boardShuv:     lerp(a.boardShuv,     b.boardShuv,     t),
    handstand:     lerp(a.handstand,     b.handstand,     t),
  };
}