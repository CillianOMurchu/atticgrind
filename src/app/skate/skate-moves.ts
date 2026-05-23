/**
 * skate-moves.ts — define individual tricks and compose them into a run.
 *
 * Usage:
 *   import { compose, roll, ollie, kickflip, shuvit, handstand } from './skate-moves';
 *
 *   const run = compose(roll(40), ollie, roll(30), kickflip, roll(30), handstand, roll(40));
 *   // run.duration  → total frames
 *   // run.getState(frame) → FrameState for that frame
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FrameState {
  /** Pixels above the ground. 0 = on the ground. */
  jh: number;
  /** Crouch amount 0-1 (component multiplies by squat px). */
  crouch: number;
  /** Board flip angle in radians (kickflip axis — cos-scales the board width). */
  boardKickflip: number;
  /** Board rotation angle in radians (shuvit axis — rotates the board in plane). */
  boardShuv: number;
  /** Handstand inversion amount 0-1 (0 = upright, 1 = fully inverted on hands). */
  handstand: number;
}

export interface Move {
  /** Length of this trick in frames (assumed 60fps). */
  duration: number;
  /** Human-readable label, useful for debugging/UI. */
  label: string;
  /**
   * Return the skater state at normalised time t ∈ [0, 1].
   * Called once per frame — keep it cheap.
   */
  getState(t: number): FrameState;
}

export interface Sequence {
  /** Total frame count for the composed run. */
  duration: number;
  /** Return the skater state for an absolute frame number. */
  getState(frame: number): FrameState;
}

// ── Private helpers ───────────────────────────────────────────────────────────

const MAX_JH = 110;

const ZERO: FrameState = { jh: 0, crouch: 0, boardKickflip: 0, boardShuv: 0, handstand: 0 };

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Sine arc between airStart and airEnd, zero outside that window. */
function arc(t: number, airStart: number, airEnd: number, height = MAX_JH): number {
  if (t <= airStart || t >= airEnd) return 0;
  return Math.sin(((t - airStart) / (airEnd - airStart)) * Math.PI) * height;
}

/**
 * Crouch ramp that peaks at the pop and on landing.
 * windStart→airStart = crouch builds; airEnd→landEnd = crouch releases.
 */
function crouch(t: number, windStart: number, airStart: number, airEnd: number, landEnd: number): number {
  if (t >= windStart && t < airStart)
    return easeInOut((t - windStart) / (airStart - windStart));
  if (t > airEnd && t <= landEnd)
    return easeInOut((landEnd - t) / (landEnd - airEnd));
  return 0;
}

// ── Moves ─────────────────────────────────────────────────────────────────────

/**
 * Plain rolling — no trick.
 * @param duration Frames to roll for (default 40).
 */
export function roll(duration = 40): Move {
  return {
    duration,
    label: 'roll',
    getState: () => ({ ...ZERO }),
  };
}

/** Standard ollie: pop, peak, land. */
export const ollie: Move = {
  duration: 70,
  label: 'ollie',
  getState(t) {
    return {
      jh:            arc(t, 0.2, 0.8),
      crouch:        crouch(t, 0, 0.2, 0.8, 1),
      boardKickflip: 0,
      boardShuv:     0,
      handstand:     0,
    };
  },
};

/** Kickflip: ollie + board flips 360° on its long axis during the air phase. */
export const kickflip: Move = {
  duration: 80,
  label: 'kickflip',
  getState(t) {
    const flipT = Math.max(0, Math.min(1, (t - 0.22) / 0.56));
    return {
      jh:            arc(t, 0.18, 0.82),
      crouch:        crouch(t, 0, 0.18, 0.82, 1),
      boardKickflip: flipT * Math.PI * 2,
      boardShuv:     0,
      handstand:     0,
    };
  },
};

/** 360 shuvit: ollie + board spins 360° in the horizontal plane. */
export const shuvit: Move = {
  duration: 70,
  label: 'shuvit',
  getState(t) {
    const shuvT = Math.max(0, Math.min(1, (t - 0.2) / 0.6));
    return {
      jh:            arc(t, 0.2, 0.8, MAX_JH * 0.85),
      crouch:        crouch(t, 0, 0.2, 0.8, 1),
      boardKickflip: 0,
      boardShuv:     shuvT * Math.PI * 2,
      handstand:     0,
    };
  },
};

/**
 * Handstand: board stays on the ground, skater rotates onto hands and holds,
 * then recovers back to upright.
 */
export const handstand: Move = {
  duration: 100,
  label: 'handstand',
  getState(t) {
    const inv =
      t < 0.25 ? easeInOut(t / 0.25) :
      t > 0.75 ? easeInOut((1 - t) / 0.25) :
      1;
    return {
      jh:            0,
      crouch:        0,
      boardKickflip: 0,
      boardShuv:     0,
      handstand:     inv,
    };
  },
};

// ── Composer ──────────────────────────────────────────────────────────────────

/**
 * Chain moves into a single Sequence.
 *
 * @example
 * const run = compose(roll(40), ollie, roll(30), kickflip, roll(30), handstand, roll(40));
 * // TOTAL = run.duration
 * // in tick: const state = run.getState(f);
 */
export function compose(...moves: Move[]): Sequence {
  const durations = moves.map(m => m.duration);
  const total     = durations.reduce((s, d) => s + d, 0);

  return {
    duration: total,
    getState(frame: number): FrameState {
      const f      = Math.min(frame, total - 1);
      let   offset = 0;
      for (let i = 0; i < moves.length; i++) {
        const d = durations[i];
        if (f < offset + d) {
          return moves[i].getState((f - offset) / d);
        }
        offset += d;
      }
      return { ...ZERO };
    },
  };
}
