import { FrameState, Sequence } from './skate-moves';

export interface SkaterConfig {
  sequence: Sequence;
  /** Frames to wait before this skater enters the scene. */
  delay: number;
  /** Body/board size multiplier — 1.0 = foreground, ~0.5 = far background. */
  scale: number;
  /** Base draw opacity. */
  alpha: number;
  /** Pixels above GROUND_Y — simulates depth on the road strip. */
  laneOffset: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Mostly-linear cruise, soft ease at the very start and end only. */
function cruise(t: number): number {
  if (t < 0.12) return t * t / 0.24;            // ease in over first 12%
  if (t > 0.88) { const u = 1 - t; return 1 - u * u / 0.24; }
  return t;                                     // linear in the middle
}

export class Skater {
  private trail: { x: number; state: FrameState; lf: number }[] = [];
  private prevJH = 0;
  private prevBaseY = 0;
  private landingLF = -999;
  private lastMark = -99;

  constructor(readonly config: SkaterConfig) {}

  get totalFrames(): number { return this.config.delay + this.config.sequence.duration; }

  isDone(frame: number): boolean {
    return (frame - this.config.delay) > this.config.sequence.duration;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    frame: number,
    W: number,
    groundY: number,
    maxJH: number,
  ): void {
    const lf = frame - this.config.delay;
    if (lf < 0 || lf > this.config.sequence.duration) return;

    const state = this.config.sequence.getState(lf);
    const x = -60 + (W + 120) * cruise(lf / this.config.sequence.duration);
    const { scale: s, alpha: a } = this.config;

    if (this.prevJH > 5 && state.jh <= 5) this.landingLF = lf;
    this.prevJH = state.jh;

    this.trail.push({ x, state, lf });
    if (this.trail.length > 4) this.trail.shift();

    if (state.jh > 10) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const t = this.trail[i];
        this.drawBody(ctx, t.x, t.state, t.lf, a * (0.08 + i * 0.04), groundY, maxJH, s);
      }
    }

    this.drawDust(ctx, x, lf, groundY, s, a);
    this.drawBody(ctx, x, state, lf, a, groundY, maxJH, s);
  }

  private drawDust(
    ctx: CanvasRenderingContext2D,
    x: number, lf: number, groundY: number, s: number, alpha: number,
  ): void {
    const since = lf - this.landingLF;
    if (since < 0 || since >= 18) return;
    const fade = 1 - since / 18;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${fade * 0.5 * alpha})`;
    ctx.lineWidth = s;
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI + (i / 5) * Math.PI;
      const len = (8 + since * 0.8 + i * 1.5) * s;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * 12 * s, groundY);
      ctx.lineTo(x + Math.cos(ang) * (12 * s + len), groundY + Math.sin(ang) * 2 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBody(
    ctx: CanvasRenderingContext2D,
    x: number, state: FrameState, lf: number,
    alpha: number, groundY: number, maxJH: number, s: number,
  ): void {
    const { jh, crouch: cr, boardKickflip, boardShuv, handstand: hs } = state;
    const base = groundY - jh * s;

    // Vertical velocity (positive = falling). Used for lean + landing squash.
    const vy = base - this.prevBaseY;
    this.prevBaseY = base;

    // Landing squash: deepen the crouch briefly after touchdown.
    const sinceLand = lf - this.landingLF;
    const squash = sinceLand >= 0 && sinceLand < 8 ? (1 - sinceLand / 8) * 6 * s : 0;

    const isAir = jh > 5;
    const tuck  = isAir ? Math.sin((jh / maxJH) * Math.PI) * 8 * s : 0;
    const squat = cr * 14 * s + squash;

    const uAnkle = base - 8  * s - tuck * 0.5;
    const uKnee  = base - 22 * s + squat * 0.5 - tuck;
    const uHip   = base - 34 * s + squat       - tuck * 0.6;
    const uShldr = base - 52 * s + squat * 0.7 - tuck * 0.3;
    const uHead  = base - 64 * s + squat * 0.5 - tuck * 0.2;

    // Handstand pose targets
    const iAnkle = groundY - 74 * s, iKnee = groundY - 60 * s;
    const iHip   = groundY - 44 * s, iShldr = groundY - 22 * s, iHead = groundY - 8 * s;

    const ankleY = lerp(uAnkle, iAnkle, hs);
    const kneeY  = lerp(uKnee,  iKnee,  hs);
    const hipY   = lerp(uHip,   iHip,   hs);
    const shldrY = lerp(uShldr, iShldr, hs);
    const headY  = lerp(uHead,  iHead,  hs);

    // Lean reacts to vertical motion: forward when falling, back when rising.
    const lean = (isAir || hs > 0) ? 0 : Math.max(-3, Math.min(3, vy * 0.4)) * s;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Shadow
    const shadowS = Math.max(0.3, 1 - jh / (maxJH * 1.4));
    ctx.save();
    ctx.globalAlpha = alpha * 0.35 * shadowS;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, groundY + 4, 22 * s * shadowS, 4 * s * shadowS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Board
    ctx.save();
    ctx.translate(x, base);
    ctx.rotate(boardShuv);
    const flipS = Math.cos(boardKickflip);
    ctx.scale(1, flipS);
    ctx.fillStyle = flipS < 0 ? '#bbb' : '#fff';
    ctx.fillRect(-19 * s, -4 * s, 38 * s, 6 * s);
    ctx.beginPath();
    ctx.arc(-13 * s, 3 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.arc( 13 * s, 3 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x - 5*s + lean, hipY);
    ctx.quadraticCurveTo(x - 13*s + lean, kneeY, x - 11*s, ankleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5*s + lean, hipY);
    ctx.quadraticCurveTo(x + 11*s + lean, kneeY, x + 9*s, ankleY);
    ctx.stroke();

    // Torso
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.8, hipY);
    ctx.lineTo(x - 3 * s + lean, shldrY);
    ctx.stroke();

    // Arms — phase-shifted swing lags the body for follow-through
    ctx.lineWidth = 4 * s;
    if (hs > 0.05) {
      const handY = lerp(shldrY + 16 * s, groundY - 4 * s, hs);
      ctx.beginPath();
      ctx.moveTo(x - 3*s + lean, shldrY + 5*s);
      ctx.quadraticCurveTo(x - 10*s, (shldrY + handY) * 0.5, x - 10*s, handY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3*s + lean, shldrY + 5*s);
      ctx.quadraticCurveTo(x + 8*s, (shldrY + handY) * 0.5, x + 8*s, handY);
      ctx.stroke();
    } else if (isAir) {
      // Arms lag the jump arc by ~0.25π so they peak after the body does.
      const t = jh / maxJH;
      const lag = Math.sin(t * Math.PI - 0.25 * Math.PI) * 0.5 + 0.5;
      const lHX = x - (18 + lag * 6) * s, lHY = shldrY - (4 + lag * 10) * s;
      const rHX = x + (16 + lag * 4) * s, rHY = shldrY + (2 - lag * 8) * s;
      ctx.beginPath();
      ctx.moveTo(x - 3*s + lean, shldrY + 5*s);
      ctx.quadraticCurveTo(x - 12*s, (shldrY + lHY) * 0.5, lHX, lHY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3*s + lean, shldrY + 5*s);
      ctx.quadraticCurveTo(x + 10*s, (shldrY + rHY) * 0.5, rHX, rHY);
      ctx.stroke();
    } else {
      // Idle/cruise: gentle counter-swing
      const swing = Math.sin(lf * 0.18) * 4 * s;
      ctx.beginPath();
      ctx.moveTo(x - 3*s + lean, shldrY + 5*s);
      ctx.quadraticCurveTo(x - 10*s + lean, shldrY + 12*s, x - 14*s + lean, shldrY + 16*s + swing);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3*s + lean, shldrY + 5*s);
      ctx.quadraticCurveTo(x + 6*s + lean, shldrY + 12*s, x + 10*s + lean, shldrY + 16*s - swing);
      ctx.stroke();
    }

    // Head
    ctx.beginPath();
    ctx.arc(x - 3 * s + lean, headY, 8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Occasional skid marks
    if (!isAir && hs === 0 && lf - this.lastMark > 12 && Math.random() < 0.08) {
      this.lastMark = lf;
      ctx.save();
      ctx.globalAlpha = alpha * 0.22;
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const dy = (i - 1) * 5 * s;
        const len = (3 - Math.abs(i - 1)) * 7 * s;
        ctx.lineWidth = Math.max(0.5, (2 - Math.abs(i - 1)) * s);
        ctx.beginPath();
        ctx.moveTo(x + 20*s, ankleY + dy);
        ctx.lineTo(x + 20*s + len, ankleY + dy);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }
}