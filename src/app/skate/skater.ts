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
  private landingLF = -999;
  private lastMark = -99;
  private wheelAngle = 0;
  private prevX = 0;

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

    // Accumulate wheel rotation from actual horizontal travel each frame
    const wheelR = 5 * s;
    this.wheelAngle += (x - this.prevX) / wheelR;
    this.prevX = x;

    if (this.prevJH > 5 && state.jh <= 5) this.landingLF = lf;
    this.prevJH = state.jh;

    this.trail.push({ x, state, lf });
    if (this.trail.length > 4) this.trail.shift();

    if (state.jh > 10) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const t = this.trail[i];
        this.drawBody(ctx, t.x, t.state, t.lf, a * (0.08 + i * 0.04), groundY, maxJH, s, this.wheelAngle);
      }
    }

    this.drawDust(ctx, x, lf, groundY, s, a);
    this.drawBody(ctx, x, state, lf, a, groundY, maxJH, s, this.wheelAngle);
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
    wheelAngle: number,
  ): void {
    const {
      jh, crouch: cr, boardKickflip, boardShuv, handstand: hs,
      torsoLean, headTilt, spineTwist, armL, armR,
    } = state;
    const base = groundY - jh * s;

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

    // torsoLean drives the horizontal body lean (radians → pixel offset).
    // spineTwist adds a lateral shoulder offset for shuv/kickflip counter-rotation.
    const lean     = torsoLean * 14 * s;
    const headLean = headTilt  * 14 * s;
    const twistOff = spineTwist * 3 * s;

    // Shoulder pivot — lean shifts it forward, twist shifts it laterally.
    const shldrX = x - 3 * s + lean + twistOff;
    const shY    = shldrY + 5 * s;

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

    // Board + wheels
    ctx.save();
    ctx.translate(x, base);
    ctx.rotate(boardShuv);
    const flipS = Math.cos(boardKickflip);
    ctx.scale(1, flipS);

    // Deck — sits above wheel centres
    ctx.fillStyle = flipS < 0 ? '#bbb' : '#fff';
    ctx.fillRect(-20 * s, -10 * s, 40 * s, 4 * s);

    // Spinning wheels — centre sits on the ground line (y = 0 in this context)
    const wheelR = 5 * s;
    for (const wx of [-13 * s, 13 * s]) {
      // Tyre
      ctx.fillStyle = '#ddd';
      ctx.beginPath();
      ctx.arc(wx, 0, wheelR, 0, Math.PI * 2);
      ctx.fill();

      // Spokes
      ctx.strokeStyle = 'rgba(90,90,90,0.75)';
      ctx.lineWidth = 0.9 * s;
      for (let i = 0; i < 3; i++) {
        const a = wheelAngle + (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx, 0);
        ctx.lineTo(wx + Math.cos(a) * (wheelR - 0.8 * s), Math.sin(a) * (wheelR - 0.8 * s));
        ctx.stroke();
      }

      // Hub
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(wx, 0, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Speed lines — horizontal streaks trailing behind the skater (to the left)
    if (!isAir && hs === 0) {
      ctx.save();
      ctx.lineCap = 'round';
      const bx = x - 22 * s;
      for (let i = 0; i < 5; i++) {
        const yPos = kneeY + (i - 2) * 9 * s;
        const len  = (14 + (4 - Math.abs(i - 2)) * 8) * s;
        ctx.globalAlpha = alpha * (0.10 + (4 - Math.abs(i - 2)) * 0.05);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = Math.max(0.5, (1.8 - Math.abs(i - 2) * 0.4) * s);
        ctx.beginPath();
        ctx.moveTo(bx, yPos);
        ctx.lineTo(bx - len, yPos);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs — hip shifts with lean
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
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.8, hipY);
    ctx.lineTo(shldrX, shldrY);
    ctx.stroke();

    // Arms — driven by armL / armR from state (0 = hanging, 1 = overhead)
    ctx.lineWidth = 4 * s;
    if (hs > 0.05) {
      // Handstand: both arms reach down to the ground
      const handY = lerp(shldrY + 16 * s, groundY - 4 * s, hs);
      ctx.beginPath();
      ctx.moveTo(shldrX, shY);
      ctx.quadraticCurveTo(shldrX - 7*s, (shY + handY) * 0.5, shldrX - 10*s, handY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(shldrX, shY);
      ctx.quadraticCurveTo(shldrX + 11*s, (shY + handY) * 0.5, shldrX + 8*s, handY);
      ctx.stroke();
    } else {
      // armL / armR interpolate from hanging (0) to overhead (1)
      const lHX = x - (14 + armL * 4) * s;
      const lHY = shY + (16 - armL * 24) * s;
      ctx.beginPath();
      ctx.moveTo(shldrX, shY);
      ctx.quadraticCurveTo((shldrX + lHX) * 0.5 - 3*s, (shY + lHY) * 0.5 + 3*s, lHX, lHY);
      ctx.stroke();

      const rHX = x + (13 + armR * 3) * s;
      const rHY = shY + (16 - armR * 24) * s;
      ctx.beginPath();
      ctx.moveTo(shldrX, shY);
      ctx.quadraticCurveTo((shldrX + rHX) * 0.5 + 3*s, (shY + rHY) * 0.5 + 3*s, rHX, rHY);
      ctx.stroke();
    }

    // Head — uses headLean separately so it lags the torso (overlap principle)
    ctx.beginPath();
    ctx.arc(x - 3 * s + headLean, headY, 8 * s, 0, Math.PI * 2);
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