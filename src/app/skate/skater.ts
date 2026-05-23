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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class Skater {
  private trail: TrailFrame[] = [];
  private prevJH = 0;
  private landingLocalFrame = -999;

  constructor(readonly config: SkaterConfig) {}

  get totalFrames(): number { return this.config.delay + this.config.sequence.duration; }

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
    const x = this.getX(lf, W);
    const { scale, alpha } = this.config;

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

    // Upright joints
    const uAnkle = base - 8  * s - tuck * 0.5;
    const uKnee  = base - 22 * s + squat * 0.5 - tuck;
    const uHip   = base - 34 * s + squat       - tuck * 0.6;
    const uShldr = base - 52 * s + squat * 0.7 - tuck * 0.3;
    const uHead  = base - 64 * s + squat * 0.5 - tuck * 0.2;

    // Inverted joints (handstand: hands on board, feet in air)
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

    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';  ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * s;

    // Legs
    ctx.beginPath();
    ctx.moveTo(x - 5 * s + lean, hipY);
    ctx.quadraticCurveTo(x - 13 * s + lean, kneeY, x - 11 * s, ankleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5 * s + lean, hipY);
    ctx.quadraticCurveTo(x + 11 * s + lean, kneeY, x + 9 * s, ankleY);
    ctx.stroke();

    // Torso
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.8, hipY);
    ctx.lineTo(x - 3 * s + lean, shldrY);
    ctx.stroke();

    // Arms
    ctx.lineWidth = 4 * s;
    if (hs > 0.05) {
      const handY = lerp(shldrY + 16 * s, groundY - 4 * s, hs);
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + lean, shldrY + 5 * s); ctx.lineTo(x - 10 * s, handY); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + lean, shldrY + 5 * s); ctx.lineTo(x + 8 * s, handY);  ctx.stroke();
    } else if (isAir) {
      const swing = Math.sin((jh / maxJH) * Math.PI);
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + lean, shldrY + 5 * s);
      ctx.lineTo(x - (18 + swing * 4) * s, shldrY - (8 + swing * 6) * s); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + lean, shldrY + 5 * s);
      ctx.lineTo(x + (16 + swing * 4) * s, shldrY - (2 + swing * 4) * s); ctx.stroke();
    } else {
      const armSwing = Math.sin(localFrame * 0.18) * 4 * s;
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + lean, shldrY + 5 * s);
      ctx.lineTo(x - 14 * s + lean, shldrY + 16 * s + armSwing); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + lean, shldrY + 5 * s);
      ctx.lineTo(x + 10 * s + lean, shldrY + 16 * s - armSwing); ctx.stroke();
    }

    // Head
    ctx.beginPath();
    ctx.arc(x - 3 * s + lean, headY, 8 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
