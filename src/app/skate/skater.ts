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

interface TrailFrame { x: number; state: FrameState; localFrame: number; }

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Phase frame boundaries ────────────────────────────────────────────────────
const F_FALL   = 38;
const F_RUB    = 118;   // 80 frames sitting & rubbing
const F_GETUP  = 143;   // 25 frames rising
const F_GRAB   = 160;   // 17 frames walking to board

export class Skater {
  private trail: TrailFrame[] = [];
  private prevJH = 0;
  private landingLocalFrame = -999;

  // Hit detection – updated each normal draw tick
  private lastX = 0;
  private lastGroundY = 0;

  // Fallen state
  private fallen = false;
  private fallenFrame = 0;
  private fallenX = 0;
  private fallenGroundY = 0;
  private boardX = 0;
  private boardVx = 0;
  private runX = 0;

  constructor(readonly config: SkaterConfig) {}

  get totalFrames(): number { return this.config.delay + this.config.sequence.duration; }

  /** Returns false while a fallen animation is still playing. */
  isDone(frame: number): boolean {
    if (this.fallen) return false;
    return (frame - this.config.delay) > this.config.sequence.duration;
  }

  /** True if click (canvas coords) lands on this skater's body. */
  hitTest(cx: number, cy: number): boolean {
    if (this.fallen) return false;
    const s = this.config.scale;
    return (
      cx >= this.lastX - 18 * s && cx <= this.lastX + 18 * s &&
      cy >= this.lastGroundY - 72 * s && cy <= this.lastGroundY
    );
  }

  /** Trigger the fall. Returns false if already fallen. */
  knock(): boolean {
    if (this.fallen) return false;
    this.fallen = true;
    this.fallenFrame = 0;
    this.fallenX = this.lastX;
    this.fallenGroundY = this.lastGroundY;
    this.boardX = this.lastX + 6 * this.config.scale;
    this.boardVx = 3.8;
    this.runX = this.lastX;
    this.trail = [];
    return true;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    frame: number,
    W: number,
    groundY: number,
    maxJH: number,
  ): void {
    if (this.fallen) {
      this.drawFallenAnimation(ctx, W);
      return;
    }

    const lf = frame - this.config.delay;
    if (lf < 0 || lf > this.config.sequence.duration) return;

    const state = this.config.sequence.getState(lf);
    const x = this.getX(lf, W);
    const { scale, alpha } = this.config;

    this.lastX = x;
    this.lastGroundY = groundY;

    if (this.prevJH > 5 && state.jh <= 5) this.landingLocalFrame = lf;
    this.prevJH = state.jh;

    this.trail.push({ x, state, localFrame: lf });
    if (this.trail.length > 4) this.trail.shift();

    if (state.jh > 10) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const t = this.trail[i];
        this.drawBody(ctx, t.x, t.state, t.localFrame, alpha * (0.08 + i * 0.04), groundY, maxJH, scale);
      }
    }

    this.drawDust(ctx, x, lf, groundY, scale, alpha);
    this.drawBody(ctx, x, state, lf, alpha, groundY, maxJH, scale);
  }

  private getX(localFrame: number, W: number): number {
    return -60 + (W + 120) * easeInOutCubic(localFrame / this.config.sequence.duration);
  }

  // ── Fallen animation state machine ───────────────────────────────────────

  private drawFallenAnimation(ctx: CanvasRenderingContext2D, W: number): void {
    const s = this.config.scale;
    const a = this.config.alpha;
    const gY = this.fallenGroundY;

    this.fallenFrame++;
    const f = this.fallenFrame;

    if (this.boardVx > 0.06) {
      this.boardX += this.boardVx;
      this.boardVx *= 0.93;
    }

    if (f <= F_FALL) {
      this.drawFallingLerp(ctx, this.fallenX, gY, easeInOut(f / F_FALL), s, a);
      this.drawFreeBoard(ctx, this.boardX, gY, s, a);
    } else if (f <= F_RUB) {
      this.drawSitting(ctx, this.fallenX, gY, f, s, a);
      this.drawFreeBoard(ctx, this.boardX, gY, s, a);
    } else if (f <= F_GETUP) {
      const t = easeInOut((f - F_RUB) / (F_GETUP - F_RUB));
      this.drawFallingLerp(ctx, this.fallenX, gY, 1 - t, s, a);
      this.drawFreeBoard(ctx, this.boardX, gY, s, a);
    } else if (f <= F_GRAB) {
      const t = easeInOut((f - F_GETUP) / (F_GRAB - F_GETUP));
      const walkX = this.fallenX + (this.boardX - this.fallenX) * t;
      this.drawUpright(ctx, walkX, gY, f, s, a);
      this.drawFreeBoard(ctx, t > 0.72 ? walkX : this.boardX, gY, s, a);
      this.runX = walkX;
    } else {
      const speed = 5 * s + (f - F_GRAB) * 0.05;
      this.runX += speed;
      if (this.runX > W + 140) { this.fallen = false; return; }
      this.drawRunning(ctx, this.runX, gY, f, s, a);
    }
  }

  /** Lerps from upright (t=0) to lying flat on back (t=1). */
  private drawFallingLerp(
    ctx: CanvasRenderingContext2D,
    x: number, gY: number, t: number, s: number, alpha: number,
  ): void {
    const ankleX = lerp(x,        x + 0,     t); const ankleY = lerp(gY - 8*s,  gY,        t);
    const kneeX  = lerp(x,        x + 14*s,  t); const kneeY  = lerp(gY - 22*s, gY - 3*s,  t);
    const hipX   = lerp(x,        x + 28*s,  t); const hipY   = lerp(gY - 34*s, gY - 2*s,  t);
    const shldrX = lerp(x - 3*s,  x + 46*s,  t); const shldrY = lerp(gY - 52*s, gY - 8*s,  t);
    const headX  = lerp(x - 3*s,  x + 58*s,  t); const headY  = lerp(gY - 64*s, gY - 14*s, t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * s;

    ctx.beginPath();
    ctx.moveTo(hipX - 4*s*(1-t), hipY);
    ctx.quadraticCurveTo(kneeX - 5*s*(1-t), kneeY, ankleX - 4*s*(1-t), ankleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hipX + 4*s*(1-t), hipY);
    ctx.quadraticCurveTo(kneeX + 4*s*(1-t), kneeY, ankleX + 3*s*(1-t), ankleY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hipX, hipY); ctx.lineTo(shldrX, shldrY); ctx.stroke();

    ctx.lineWidth = 4 * s;
    const spread = t * 20 * s;
    ctx.beginPath();
    ctx.moveTo(shldrX, shldrY);
    ctx.lineTo(shldrX - 10*s, shldrY - 8*s + spread * 0.4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shldrX, shldrY);
    ctx.lineTo(shldrX + 10*s, shldrY + spread * 0.5); ctx.stroke();

    ctx.beginPath();
    ctx.arc(headX, headY, 8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Sitting on ground — rubbing bum in embarrassment. */
  private drawSitting(
    ctx: CanvasRenderingContext2D,
    x: number, gY: number, frame: number, s: number, alpha: number,
  ): void {
    const hipY   = gY - 18*s;
    const shldrX = x - 8*s,  shldrY = gY - 36*s;
    const headX  = x - 10*s, headY  = gY - 48*s;
    const kneeX  = x + 22*s, kneeY  = gY - 12*s;
    const ankleX = x + 32*s, ankleY = gY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * s;

    ctx.beginPath();
    ctx.moveTo(x, hipY); ctx.quadraticCurveTo(kneeX, kneeY, ankleX, ankleY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4*s, hipY); ctx.quadraticCurveTo(kneeX - 9*s, kneeY + 4*s, ankleX - 6*s, ankleY); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, hipY); ctx.lineTo(shldrX, shldrY); ctx.stroke();

    ctx.lineWidth = 4 * s;

    // Rubbing arm — swings behind body
    const rub = Math.sin(frame * 0.28) * 10 * s;
    ctx.beginPath();
    ctx.moveTo(shldrX, shldrY);
    ctx.lineTo(x + 8*s + rub * 0.4, gY - 8*s + rub); ctx.stroke();

    // Other arm raised — embarrassed wave
    const wave = Math.sin(frame * 0.14) * 5 * s;
    ctx.beginPath();
    ctx.moveTo(shldrX, shldrY);
    ctx.lineTo(shldrX - 14*s, shldrY - 12*s + wave); ctx.stroke();

    ctx.beginPath();
    ctx.arc(headX, headY, 8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Plain upright walking pose. */
  private drawUpright(
    ctx: CanvasRenderingContext2D,
    x: number, gY: number, frame: number, s: number, alpha: number,
  ): void {
    const step = Math.sin(frame * 0.38) * 8 * s;
    const ankleY = gY - 8*s, kneeY = gY - 22*s;
    const hipY = gY - 34*s, shldrY = gY - 52*s, headY = gY - 64*s;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * s;

    ctx.beginPath();
    ctx.moveTo(x - 5*s, hipY); ctx.quadraticCurveTo(x - 13*s, kneeY + step, x - 11*s, ankleY + step * 0.5); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5*s, hipY); ctx.quadraticCurveTo(x + 11*s, kneeY - step, x + 9*s, ankleY - step * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x - 3*s, shldrY); ctx.stroke();

    ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x - 3*s, shldrY + 5*s); ctx.lineTo(x - 14*s, shldrY + 16*s - step * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3*s, shldrY + 5*s); ctx.lineTo(x + 10*s, shldrY + 16*s + step * 0.5); ctx.stroke();

    ctx.beginPath(); ctx.arc(x - 3*s, headY, 8*s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Fast running with board at feet — chasing the others. */
  private drawRunning(
    ctx: CanvasRenderingContext2D,
    x: number, gY: number, frame: number, s: number, alpha: number,
  ): void {
    const run = Math.sin(frame * 0.55) * 14 * s;
    const ankleY = gY - 8*s, kneeY = gY - 22*s;
    const hipY = gY - 34*s, shldrY = gY - 52*s, headY = gY - 64*s;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';

    // Board under feet
    ctx.fillRect(x - 19*s, gY - 4*s, 38*s, 6*s);
    ctx.beginPath();
    ctx.arc(x - 13*s, gY + 3*s, 3.5*s, 0, Math.PI * 2);
    ctx.arc(x + 13*s,  gY + 3*s, 3.5*s, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * s;

    ctx.beginPath();
    ctx.moveTo(x - 5*s, hipY); ctx.quadraticCurveTo(x - 13*s, kneeY + run, x - 11*s, ankleY + run * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5*s, hipY); ctx.quadraticCurveTo(x + 11*s, kneeY - run, x + 9*s, ankleY - run * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x - 3*s, shldrY); ctx.stroke();

    ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x - 3*s, shldrY + 5*s); ctx.lineTo(x - 18*s, shldrY - 5*s + run * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3*s, shldrY + 5*s); ctx.lineTo(x + 14*s, shldrY - 3*s - run * 0.3); ctx.stroke();

    ctx.beginPath(); ctx.arc(x - 3*s, headY, 8*s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Board rolling free on the ground after the fall. */
  private drawFreeBoard(
    ctx: CanvasRenderingContext2D,
    bx: number, gY: number, s: number, alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 19*s, gY - 4*s, 38*s, 6*s);
    ctx.beginPath();
    ctx.arc(bx - 13*s, gY + 3*s, 3.5*s, 0, Math.PI * 2);
    ctx.arc(bx + 13*s,  gY + 3*s, 3.5*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Normal animation helpers ──────────────────────────────────────────────

  private drawDust(
    ctx: CanvasRenderingContext2D,
    x: number, localFrame: number, groundY: number, scale: number, alpha: number,
  ): void {
    const since = localFrame - this.landingLocalFrame;
    if (since < 0 || since >= 18) return;
    const fade = 1 - since / 18;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${fade * 0.5 * alpha})`;
    ctx.lineWidth = scale;
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI + (i / 5) * Math.PI;
      const len = (8 + since * 0.8 + i * 1.5) * scale;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 12 * scale, groundY);
      ctx.lineTo(x + Math.cos(angle) * (12 * scale + len), groundY + Math.sin(angle) * 2 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBody(
    ctx: CanvasRenderingContext2D,
    x: number, state: FrameState, localFrame: number,
    alpha: number, groundY: number, maxJH: number, s: number,
  ): void {
    const { jh, crouch: cr, boardKickflip, boardShuv, handstand: hs } = state;
    const base   = groundY - jh * s;
    const squat  = cr * 14 * s;
    const isAir  = jh > 5;
    const tuck   = isAir ? Math.sin((jh / maxJH) * Math.PI) * 8 * s : 0;

    const uAnkle = base - 8  * s - tuck * 0.5;
    const uKnee  = base - 22 * s + squat * 0.5 - tuck;
    const uHip   = base - 34 * s + squat       - tuck * 0.6;
    const uShldr = base - 52 * s + squat * 0.7 - tuck * 0.3;
    const uHead  = base - 64 * s + squat * 0.5 - tuck * 0.2;

    const iAnkle = groundY - 74 * s;
    const iKnee  = groundY - 60 * s;
    const iHip   = groundY - 44 * s;
    const iShldr = groundY - 22 * s;
    const iHead  = groundY - 8  * s;

    const ankleY = lerp(uAnkle, iAnkle, hs);
    const kneeY  = lerp(uKnee,  iKnee,  hs);
    const hipY   = lerp(uHip,   iHip,   hs);
    const shldrY = lerp(uShldr, iShldr, hs);
    const headY  = lerp(uHead,  iHead,  hs);
    const lean   = (isAir || hs > 0) ? 0 : Math.sin(localFrame * 0.15) * 1.5 * s;

    ctx.save();
    ctx.globalAlpha = alpha;

    const shadowS = Math.max(0.3, 1 - jh / (maxJH * 1.4));
    ctx.save();
    ctx.globalAlpha = alpha * 0.35 * shadowS;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, groundY + 4, 22 * s * shadowS, 4 * s * shadowS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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

    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';  ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * s;

    ctx.beginPath();
    ctx.moveTo(x - 5 * s + lean, hipY);
    ctx.quadraticCurveTo(x - 13 * s + lean, kneeY, x - 11 * s, ankleY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5 * s + lean, hipY);
    ctx.quadraticCurveTo(x + 11 * s + lean, kneeY, x + 9 * s, ankleY); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + lean * 0.8, hipY); ctx.lineTo(x - 3 * s + lean, shldrY); ctx.stroke();

    ctx.lineWidth = 4 * s;
    if (hs > 0.05) {
      const handY = lerp(shldrY + 16 * s, groundY - 4 * s, hs);
      ctx.beginPath(); ctx.moveTo(x - 3*s + lean, shldrY + 5*s); ctx.lineTo(x - 10*s, handY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3*s + lean, shldrY + 5*s); ctx.lineTo(x + 8*s, handY);  ctx.stroke();
    } else if (isAir) {
      const swing = Math.sin((jh / maxJH) * Math.PI);
      ctx.beginPath(); ctx.moveTo(x - 3*s + lean, shldrY + 5*s); ctx.lineTo(x - (18+swing*4)*s, shldrY - (8+swing*6)*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3*s + lean, shldrY + 5*s); ctx.lineTo(x + (16+swing*4)*s, shldrY - (2+swing*4)*s); ctx.stroke();
    } else {
      const armSwing = Math.sin(localFrame * 0.18) * 4 * s;
      ctx.beginPath(); ctx.moveTo(x - 3*s + lean, shldrY + 5*s); ctx.lineTo(x - 14*s + lean, shldrY + 16*s + armSwing); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3*s + lean, shldrY + 5*s); ctx.lineTo(x + 10*s + lean, shldrY + 16*s - armSwing); ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x - 3 * s + lean, headY, 8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
