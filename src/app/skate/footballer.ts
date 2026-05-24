const GRAVITY  = 0.45;
const FRICTION = 0.87;
const BOUNCE   = 0.58;

const WAIT_F         = 40;
const PLAYER_ENTER_F = 70;
const KICK_F         = 44;

type Phase = 'ball_drop' | 'wait' | 'player_enter' | 'kick' | 'chase' | 'done';

const PHASE_ORDER: Phase[] = [
  'ball_drop', 'wait', 'player_enter', 'kick', 'chase', 'done',
];

function easeOut(t: number): number { return 1 - (1 - t) * (1 - t); }
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function seg(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  jx: number, jy: number,
  x2: number, y2: number,
  lw: number, jr: number,
): void {
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(jx, jy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(x2, y2); ctx.stroke();
  if (jr > 0) { ctx.beginPath(); ctx.arc(jx, jy, jr, 0, Math.PI * 2); ctx.fill(); }
}

export class Footballer {
  private frame      = 0;
  private phase: Phase = 'ball_drop';
  private phaseFrame = 0;

  private px: number;
  private bx: number;
  private by: number;
  private bvx = 0;
  private bvy = 0;
  private ballSpin = 0;

  private readonly BALL_R = 10;
  private readonly BASE_GY: number;
  private readonly W: number;

  private ballSettledX = 0;
  private playerStopX  = 0;

  constructor(W: number, baseGroundY: number, ballDropX: number, ballDropY: number) {
    this.W        = W;
    this.BASE_GY  = baseGroundY;
    this.bx       = ballDropX;
    this.by       = ballDropY;
    this.px       = W + 100;
    this.ballSettledX = ballDropX;
  }

  isDone(): boolean { return this.phase === 'done'; }

  private get gY(): number { return this.BASE_GY; }

  private nextPhase(): void {
    const idx = PHASE_ORDER.indexOf(this.phase);
    if (idx < PHASE_ORDER.length - 1) {
      this.phase = PHASE_ORDER[idx + 1];
      this.phaseFrame = 0;
      if (this.phase === 'wait') {
        this.ballSettledX = this.bx;
        this.bvx = 0;
        this.bvy = 0;
        this.by  = this.gY - this.BALL_R;
        // Close enough for the kicking foot to reach the ball
        this.playerStopX = this.ballSettledX + 30;
      }
    }
  }

  update(): void {
    this.frame++;
    this.phaseFrame++;
    const gY = this.gY;
    const pf = this.phaseFrame;

    switch (this.phase) {

      case 'ball_drop': {
        this.bx  += this.bvx;
        this.by  += this.bvy;
        this.bvy += GRAVITY;

        if (this.by >= gY - this.BALL_R) {
          this.by = gY - this.BALL_R;
          if (Math.abs(this.bvy) > 1.2) {
            this.bvy *= -BOUNCE;
            this.bvx *= FRICTION;
          } else {
            this.bvy = 0;
            this.bvx *= 0.85;
          }
        }

        const settled = this.by >= gY - this.BALL_R - 1
          && Math.abs(this.bvy) < 0.6
          && pf > 40;
        if (settled || pf > 170) this.nextPhase();
        break;
      }

      case 'wait': {
        this.ballSpin += 0.008;
        if (pf >= WAIT_F) this.nextPhase();
        break;
      }

      case 'player_enter': {
        const t = clamp(pf / PLAYER_ENTER_F, 0, 1);
        this.px = this.W + 100 + (this.playerStopX - (this.W + 100)) * easeOut(t);
        if (t >= 1) { this.px = this.playerStopX; this.nextPhase(); }
        break;
      }

      case 'kick': {
        // pf 28: foot near full extension — ball launches
        if (pf === 28) {
          this.bvx = -20 - Math.random() * 3;
          this.bvy = -9  - Math.random() * 1.5;
          this.ballSpin = 0.55;
        }
        if (pf >= 28) {
          this.bx  += this.bvx;
          this.by  += this.bvy;
          this.bvy += GRAVITY;
          this.ballSpin = this.bvx * -0.028;
          if (this.by >= gY - this.BALL_R) {
            this.by = gY - this.BALL_R;
            if (Math.abs(this.bvy) > 0.8) {
              this.bvy *= -BOUNCE;
              this.bvx *= FRICTION;
            } else {
              this.bvy = 0;
              this.bvx *= FRICTION + 0.02;
            }
          }
        }
        if (pf >= KICK_F) this.nextPhase();
        break;
      }

      case 'chase': {
        this.px  -= 5.8;
        this.bx  += this.bvx;
        this.by  += this.bvy;
        this.bvy += GRAVITY;
        this.ballSpin = this.bvx * -0.028;
        if (this.by >= gY - this.BALL_R) {
          this.by = gY - this.BALL_R;
          if (Math.abs(this.bvy) > 0.8) {
            this.bvy *= -BOUNCE;
            this.bvx *= FRICTION;
          } else {
            this.bvy = 0;
            this.bvx *= FRICTION + 0.02;
          }
        }
        if (this.px < -120) this.nextPhase();
        break;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'done') return;
    this.drawBall(ctx);
    if (
      this.phase === 'player_enter' ||
      this.phase === 'kick'         ||
      this.phase === 'chase'
    ) {
      this.drawPlayer(ctx);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D): void {
    const r   = this.BALL_R;
    const gY  = this.gY;
    const by  = Math.min(this.by, gY - r);
    const airH = (gY - r) - by;
    const ss  = Math.max(0.18, 1 - airH / 120);

    ctx.save();
    ctx.globalAlpha = 0.22 * ss;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(this.bx, gY + 2, r * ss * 1.1, 2.5 * ss, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.bx, by, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(70, 100, 155, 0.5)';
    ctx.lineWidth   = 1.1;
    for (let i = 0; i < 5; i++) {
      const a  = this.ballSpin + (i / 5) * Math.PI * 2;
      const a2 = this.ballSpin + ((i + 1) / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(this.bx + Math.cos(a)  * r * 0.38, by + Math.sin(a)  * r * 0.38);
      ctx.lineTo(this.bx + Math.cos(a)  * r * 0.88, by + Math.sin(a)  * r * 0.88);
      ctx.lineTo(this.bx + Math.cos(a2) * r * 0.88, by + Math.sin(a2) * r * 0.88);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const x  = this.px;
    const s  = 0.92;
    const gY = this.gY;
    const pf = this.phaseFrame;

    const ankleY    = gY - 8  * s;
    const kneeY     = gY - 30 * s;
    const hipY      = gY - 48 * s;
    const shldrY    = gY - 70 * s;
    const headBaseY = gY - 84 * s;

    let run        = 0;
    let lean       = 0;
    let headDrop   = 0;
    let backswingT = 0;
    let strikeT    = 0;

    switch (this.phase) {
      case 'player_enter': {
        const t = clamp(pf / PLAYER_ENTER_F, 0, 1);
        run  = Math.sin(pf * 0.35) * 13 * s;
        lean = t > 0.75 ? (1 - (t - 0.75) / 0.25) * 4 * s : 4 * s;
        break;
      }
      case 'kick': {
        if (pf <= 6) {
          // Final approach strides
          run  = Math.sin(pf * 0.42) * 14 * s;
          lean = 6 * s;
        } else if (pf <= 18) {
          // Plant and backswing: knee folds back high, ankle rises well above hip
          lean       = 10 * s;
          backswingT = Math.sin(((pf - 6) / 12) * Math.PI * 0.5); // ease-in 0→1
          headDrop   = backswingT * 12 * s; // head nods over ball
        } else if (pf <= 30) {
          // Explosive forward strike
          lean       = 12 * s;
          backswingT = 1.0;
          strikeT    = (pf - 18) / 12; // linear 0→1
          headDrop   = Math.max(0, 1 - strikeT) * 8 * s;
        } else {
          // Follow-through and recovery
          lean       = Math.max(4, 12 - ((pf - 30) / 14) * 8) * s;
          backswingT = 1.0;
          strikeT    = 1.0;
        }
        break;
      }
      case 'chase': {
        run  = Math.sin(pf * 0.44) * 16 * s;
        lean = 8 * s;
        break;
      }
    }

    ctx.save();

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(x, gY + 3, 18 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    const shldrX = x + 2 * s - lean;

    const inKick = (this.phase === 'kick' && pf > 6);

    if (inKick) {
      // Plant leg (right): foot placed forward toward ball, slightly bent for stability
      seg(ctx, x+5*s, hipY, x+2*s, kneeY, x-4*s, ankleY, 5*s, 2.5*s);

      // Kicking leg (left): sweeps from neutral → high backswing → explosive strike
      // Neutral
      const nKneeX  = x - 5*s,  nKneeY  = kneeY;
      const nAnkleX = x - 3*s,  nAnkleY = ankleY;
      // Full backswing: ankle pulled high behind body (above hip level)
      const bsKneeX  = x + 10*s, bsKneeY  = hipY + 10*s;
      const bsAnkleX = x + 14*s, bsAnkleY = hipY - 14*s;
      // Full strike: leg fully extended forward at ball
      const stKneeX  = x - 22*s, stKneeY  = kneeY - 8*s;
      const stAnkleX = x - 36*s, stAnkleY = ankleY + 2*s;

      const kKneeX  = lerp(lerp(nKneeX,  bsKneeX,  backswingT), stKneeX,  strikeT);
      const kKneeY  = lerp(lerp(nKneeY,  bsKneeY,  backswingT), stKneeY,  strikeT);
      const kAnkleX = lerp(lerp(nAnkleX, bsAnkleX, backswingT), stAnkleX, strikeT);
      const kAnkleY = lerp(lerp(nAnkleY, bsAnkleY, backswingT), stAnkleY, strikeT);

      seg(ctx, x-5*s, hipY, kKneeX, kKneeY, kAnkleX, kAnkleY, 5*s, 2.5*s);
    } else {
      seg(ctx, x-5*s, hipY, x - 14*s, kneeY + run, x - 12*s, ankleY + run * 0.5, 5*s, 2.5*s);
      seg(ctx, x+5*s, hipY, x + 12*s, kneeY - run, x + 10*s, ankleY - run * 0.5, 5*s, 2.5*s);
    }

    // Torso
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(shldrX, shldrY);
    ctx.stroke();

    // Arms
    ctx.lineWidth = 4 * s;
    const shX = shldrX, shY = shldrY + 5 * s;

    if (inKick) {
      // Arms spread wide for rotational balance
      const spread = clamp(backswingT + strikeT, 0, 1) * 10 * s;
      const lHX = x - 18*s - spread, lHY = shY + 14*s;
      seg(ctx, shX, shY, (shX + lHX) * 0.5 - 4*s, (shY + lHY) * 0.5 + 3*s, lHX, lHY, 4*s, 2*s);
      const rHX = x + 18*s + spread, rHY = shY + 14*s;
      seg(ctx, shX, shY, (shX + rHX) * 0.5 + 4*s, (shY + rHY) * 0.5 + 3*s, rHX, rHY, 4*s, 2*s);
    } else {
      const lHX = x - 15*s, lHY = shY + 20*s + run * 0.35;
      seg(ctx, shX, shY, (shX + lHX) * 0.5 - 4*s, (shY + lHY) * 0.5 + 3*s, lHX, lHY, 4*s, 2*s);
      const rHX = x + 13*s, rHY = shY + 20*s - run * 0.35;
      seg(ctx, shX, shY, (shX + rHX) * 0.5 + 4*s, (shY + rHY) * 0.5 + 3*s, rHX, rHY, 4*s, 2*s);
    }

    // Head — nods down toward ball during backswing, follows shoulder lean
    const headY = headBaseY + headDrop;
    ctx.beginPath();
    ctx.arc(shldrX, headY, 9 * s, 0, Math.PI * 2);
    ctx.fill();

    // Speed lines when chasing
    if (this.phase === 'chase' && this.frame % 8 < 3) {
      const mx = x + 22 * s, my = ankleY;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const dy  = (i - 1) * 5 * s;
        const len = (3 - Math.abs(i - 1)) * 9 * s;
        ctx.lineWidth = Math.max(0.5, (2 - Math.abs(i - 1)) * s);
        ctx.beginPath();
        ctx.moveTo(mx, my + dy);
        ctx.lineTo(mx + len, my + dy);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }
}
