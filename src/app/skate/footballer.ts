const GRAVITY  = 0.40;
const FRICTION = 0.91;  // rolling deceleration per frame
const BOUNCE   = 0.52;  // vertical velocity retained on bounce

export class Footballer {
  private frame    = 0;
  private px: number;       // footballer x
  private bx: number;       // ball x
  private by: number;       // ball y
  private bvx      = -13;   // ball velocity x (initial kick left)
  private bvy      = -5;    // ball velocity y
  private kicking  = false;
  private kickTimer = 0;

  private readonly SPEED  = 3.8;
  private readonly BALL_R = 8;
  private readonly BASE_GY: number;

  constructor(startX: number, baseGroundY: number) {
    this.px      = startX;
    this.BASE_GY = baseGroundY;
    this.bx      = startX - 30;
    this.by      = baseGroundY - this.BALL_R;
  }

  isDone(): boolean { return this.px < -120; }

  // Ground Y oscillates slowly to simulate weaving between depth lanes
  private get gY(): number {
    return this.BASE_GY + Math.sin(this.frame * 0.018) * 28;
  }

  update(): void {
    this.frame++;
    this.px -= this.SPEED;

    const gY = this.gY;

    // Ball physics
    this.bx  += this.bvx;
    this.by  += this.bvy;
    this.bvy += GRAVITY;

    // Bounce on ground
    if (this.by >= gY - this.BALL_R) {
      this.by = gY - this.BALL_R;
      if (Math.abs(this.bvy) > 1.0) {
        this.bvy *= -BOUNCE;
        this.bvx *= FRICTION;
      } else {
        this.bvy  = 0;
        this.bvx *= FRICTION;
      }
    }

    // Kick countdown
    if (this.kicking) {
      this.kickTimer++;
      if (this.kickTimer === 10) {
        this.bvx = -12 - Math.random() * 4;
        this.bvy = -5  - Math.random() * 2;
      }
      if (this.kickTimer > 22) this.kicking = false;
    }

    // Trigger kick when footballer reaches the ball
    const dx = this.bx - this.px;
    if (!this.kicking && dx > -35 && dx < 8) {
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

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.25 * ss;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(this.bx, gY + 2, r * ss, 2.5 * ss, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.bx, by, r, 0, Math.PI * 2);
    ctx.fill();

    // 5-spoke rotation marks (classic football look)
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

    // Taller proportions than the skater
    const ankleY = gY - 8  * s;
    const kneeY  = gY - 30 * s;
    const hipY   = gY - 48 * s;
    const shldrX = x  +  2 * s;
    const shldrY = gY - 70 * s;
    const headY  = gY - 84 * s;

    ctx.save();

    // Shadow
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
    ctx.lineWidth   = 5 * s;

    // Legs
    if (kickT > 0.05) {
      // Standing leg (right, planted)
      ctx.beginPath();
      ctx.moveTo(x + 5 * s, hipY);
      ctx.quadraticCurveTo(x + 11 * s, kneeY, x + 8 * s, ankleY + 4 * s);
      ctx.stroke();
      // Kicking leg (left, sweeps forward)
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, hipY);
      ctx.quadraticCurveTo(
        x - 12 * s - kickT * 15 * s, kneeY,
        x - 18 * s - kickT * 30 * s, ankleY + kickT * 8 * s,
      );
      ctx.stroke();
    } else {
      // Running — mirrored for left-facing
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, hipY);
      ctx.quadraticCurveTo(x - 14 * s, kneeY + run, x - 12 * s, ankleY + run * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 5 * s, hipY);
      ctx.quadraticCurveTo(x + 12 * s, kneeY - run, x + 10 * s, ankleY - run * 0.5);
      ctx.stroke();
    }

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(shldrX, shldrY);
    ctx.stroke();

    // Arms (swing opposite to legs)
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(shldrX, shldrY + 5 * s);
    ctx.lineTo(x - 15 * s, shldrY + 20 * s + run * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shldrX, shldrY + 5 * s);
    ctx.lineTo(x + 13 * s, shldrY + 20 * s - run * 0.35);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(shldrX, headY, 9 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
