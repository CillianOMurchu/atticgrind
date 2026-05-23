const GRAVITY  = 0.38;
const FRICTION = 0.87;
const BOUNCE   = 0.44;

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
  private px: number;
  private bx: number;
  private by: number;
  private bvx        = -7;
  private bvy        = -3;
  private kicking    = false;
  private kickTimer  = 0;
  private lastMark   = -99;

  private readonly SPEED  = 3.8;
  private readonly BALL_R = 8;
  private readonly BASE_GY: number;

  constructor(startX: number, baseGroundY: number) {
    this.px      = startX;
    this.BASE_GY = baseGroundY;
    this.bx      = startX - 15;
    this.by      = baseGroundY - this.BALL_R;
  }

  isDone(): boolean { return this.px < -120; }

  private get gY(): number {
    return this.BASE_GY + Math.sin(this.frame * 0.018) * 28;
  }

  update(): void {
    this.frame++;
    this.px -= this.SPEED;

    const gY = this.gY;
    this.bx += this.bvx;
    this.by += this.bvy;
    this.bvy += GRAVITY;

    if (this.by >= gY - this.BALL_R) {
      this.by = gY - this.BALL_R;
      if (Math.abs(this.bvy) > 0.8) {
        this.bvy *= -BOUNCE;
        this.bvx *= FRICTION;
      } else {
        this.bvy  = 0;
        this.bvx *= FRICTION + 0.02;
      }
    }

    if (this.kicking) {
      this.kickTimer++;
      if (this.kickTimer === 10) {
        this.bvx = -6 - Math.random() * 2;
        this.bvy = -3.5 - Math.random() * 1.5;
      }
      if (this.kickTimer > 22) this.kicking = false;
    }

    const dx = this.bx - this.px;
    if (!this.kicking && dx > -20 && dx < 5) {
      this.kicking   = true;
      this.kickTimer = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const gY = this.gY;
    this.drawBall(ctx, gY);
    this.drawPlayer(ctx, gY);
  }

  private drawBall(ctx: CanvasRenderingContext2D, gY: number): void {
    const r    = this.BALL_R;
    const by   = Math.min(this.by, gY - r);
    const airH = (gY - r) - by;
    const ss   = Math.max(0.15, 1 - airH / 90);

    ctx.save();
    ctx.globalAlpha = 0.25 * ss;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(this.bx, gY + 2, r * ss, 2.5 * ss, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    const rot = this.frame * 0.18;
    ctx.strokeStyle = 'rgba(80, 110, 160, 0.5)';
    ctx.lineWidth   = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(this.bx + Math.cos(a) * r * 0.32, by + Math.sin(a) * r * 0.32);
      ctx.lineTo(this.bx + Math.cos(a) * r * 0.85, by + Math.sin(a) * r * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, gY: number): void {
    const x     = this.px;
    const s     = 0.92;
    const run   = Math.sin(this.frame * 0.35) * 13 * s;
    const kickT = this.kicking ? Math.sin((this.kickTimer / 22) * Math.PI) : 0;

    const ankleY = gY - 8  * s;
    const kneeY  = gY - 30 * s;
    const hipY   = gY - 48 * s;
    const shldrX = x  +  2 * s;
    const shldrY = gY - 70 * s;
    const headY  = gY - 84 * s;

    ctx.save();
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(x, gY + 3, 18 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    if (kickT > 0.05) {
      // Standing leg — straight with knee bend
      seg(ctx, x+5*s, hipY,  x+11*s, kneeY,                x+8*s,              ankleY+4*s,  5*s, 2.5*s);
      // Kicking leg — sweeps forward-left
      const kKneeX  = x - 12*s - kickT*15*s;
      const kAnkleX = x - 18*s - kickT*30*s;
      const kAnkleY = ankleY + kickT*8*s;
      seg(ctx, x-5*s, hipY,  kKneeX, kneeY,                kAnkleX,            kAnkleY,     5*s, 2.5*s);
    } else {
      // Running legs
      const lKneeX = x - 14*s, lKneeY = kneeY + run;
      seg(ctx, x-5*s, hipY,  lKneeX, lKneeY,               x-12*s, ankleY+run*0.5,   5*s, 2.5*s);
      const rKneeX = x + 12*s, rKneeY = kneeY - run;
      seg(ctx, x+5*s, hipY,  rKneeX, rKneeY,               x+10*s, ankleY-run*0.5,   5*s, 2.5*s);
    }

    // Torso
    ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(shldrX, shldrY); ctx.stroke();

    // Arms with elbows
    ctx.lineWidth = 4 * s;
    const shX = shldrX, shY = shldrY + 5*s;
    const lHX = x - 15*s, lHY = shldrY + 20*s + run*0.35;
    const lEX = (shX + lHX) * 0.5 - 4*s, lEY = (shY + lHY) * 0.5 + 3*s;
    seg(ctx, shX, shY,  lEX, lEY,  lHX, lHY,  4*s, 2*s);

    const rHX = x + 13*s, rHY = shldrY + 20*s - run*0.35;
    const rEX = (shX + rHX) * 0.5 + 4*s, rEY = (shY + rHY) * 0.5 + 3*s;
    seg(ctx, shX, shY,  rEX, rEY,  rHX, rHY,  4*s, 2*s);

    // Head
    ctx.beginPath(); ctx.arc(shldrX, headY, 9*s, 0, Math.PI*2); ctx.fill();

    // Speed marks (motion lines behind feet, trailing to the right)
    if (!this.kicking && this.frame - this.lastMark > 10 && Math.random() < 0.1) {
      this.lastMark = this.frame;
      const mx = x + 20*s, my = ankleY;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const dy  = (i - 1) * 5 * s;
        const len = (3 - Math.abs(i - 1)) * 8 * s;
        ctx.lineWidth = Math.max(0.5, (2 - Math.abs(i - 1)) * s);
        ctx.beginPath(); ctx.moveTo(mx, my + dy); ctx.lineTo(mx + len, my + dy); ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }
}
