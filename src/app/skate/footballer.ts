const GRAVITY  = 0.38;
const FRICTION = 0.87;
const BOUNCE   = 0.42;

// Phase durations in frames (~60fps)
const BALL_ENTER_F    = 88;
const WAIT_F          = 50;
const PLAYER_ENTER_F  = 88;
const RUNUP_BACK_F    = 52;
const RUNUP_CHARGE_F  = 58;
const KICK_F          = 32;

type Phase =
  | 'ball_enter'
  | 'wait'
  | 'player_enter'
  | 'runup_back'
  | 'runup_charge'
  | 'kick'
  | 'chase'
  | 'done';

const PHASE_ORDER: Phase[] = [
  'ball_enter', 'wait', 'player_enter',
  'runup_back', 'runup_charge', 'kick', 'chase', 'done',
];

function easeOut(t: number): number { return 1 - (1 - t) * (1 - t); }
function easeIn(t:  number): number { return t * t; }
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

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
  private phase: Phase = 'ball_enter';
  private phaseFrame = 0;

  private px: number;
  private bx: number;
  private by: number;
  private bvx = 0;
  private bvy = 0;
  private ballSpin = 0;

  private readonly BALL_R = 10;
  private readonly BASE_GY: number;

  // Key x positions — derived from canvas width (startX = W + 100)
  private readonly ballStartX:    number;
  private readonly ballTargetX:   number;
  private readonly playerStartX:  number;
  private readonly playerStopX:   number;  // rests here after entering
  private readonly playerSetupX:  number;  // backs up to here for run-up
  private readonly kickPositionX: number;  // foot contacts ball here

  constructor(startX: number, baseGroundY: number) {
    this.BASE_GY      = baseGroundY;
    this.playerStartX = startX;

    const W = startX - 100; // startX = W + 100

    this.ballStartX    = W + 30;
    this.ballTargetX   = W * 0.5;
    this.playerStopX   = this.ballTargetX + 155;
    this.playerSetupX  = this.ballTargetX + 268;
    this.kickPositionX = this.ballTargetX + 24;

    this.px = startX;
    this.bx = this.ballStartX;
    this.by = baseGroundY - this.BALL_R;
  }

  isDone(): boolean { return this.phase === 'done'; }

  private get gY(): number { return this.BASE_GY; }

  private nextPhase(): void {
    const idx = PHASE_ORDER.indexOf(this.phase);
    if (idx < PHASE_ORDER.length - 1) {
      this.phase = PHASE_ORDER[idx + 1];
      this.phaseFrame = 0;
    }
  }

  update(): void {
    this.frame++;
    this.phaseFrame++;
    const gY = this.gY;
    const pf = this.phaseFrame;

    switch (this.phase) {

      case 'ball_enter': {
        // Ball glides in from off-screen right, decelerates smoothly to centre
        const t = clamp(pf / BALL_ENTER_F, 0, 1);
        this.bx = this.ballStartX + (this.ballTargetX - this.ballStartX) * easeOut(t);
        this.ballSpin += 0.22 * (1 - t * 0.8); // slows spin as ball slows
        if (t >= 1) { this.bx = this.ballTargetX; this.nextPhase(); }
        break;
      }

      case 'wait': {
        this.bx = this.ballTargetX;
        // Tiny settle bob — ball compresses then sits still
        this.ballSpin += 0.04;
        if (pf >= WAIT_F) this.nextPhase();
        break;
      }

      case 'player_enter': {
        // Player jogs onto screen, slows to a stop
        const t = clamp(pf / PLAYER_ENTER_F, 0, 1);
        this.px = this.playerStartX + (this.playerStopX - this.playerStartX) * easeOut(t);
        if (t >= 1) { this.px = this.playerStopX; this.nextPhase(); }
        break;
      }

      case 'runup_back': {
        // Player backs up deliberately, setting up the run-up angle.
        // First 12 frames: momentary pause (looking at ball).
        // Remaining: stride backward with bouncy ease.
        if (pf <= 12) {
          // Stationary — slight weight-shift only, handled in draw
        } else {
          const t = clamp((pf - 12) / (RUNUP_BACK_F - 12), 0, 1);
          this.px = this.playerStopX + (this.playerSetupX - this.playerStopX) * easeInOut(t);
        }
        if (pf >= RUNUP_BACK_F) { this.px = this.playerSetupX; this.nextPhase(); }
        break;
      }

      case 'runup_charge': {
        // Player accelerates hard toward the ball — ease-in so they build up speed
        const t = clamp(pf / RUNUP_CHARGE_F, 0, 1);
        this.px = this.playerSetupX + (this.kickPositionX - this.playerSetupX) * easeIn(t);
        if (t >= 1) { this.px = this.kickPositionX; this.nextPhase(); }
        break;
      }

      case 'kick': {
        // Kick connects at frame 14 — ball flies hard to the left
        if (pf === 14) {
          this.bvx = -21 - Math.random() * 3;
          this.bvy = -8.5 - Math.random() * 1.5;
          this.ballSpin = 0.62; // strong backspin on kick
        }
        // Ball physics post-kick
        if (pf >= 14) {
          this.bx      += this.bvx;
          this.by      += this.bvy;
          this.bvy     += GRAVITY;
          this.ballSpin = this.bvx * -0.028; // spin proportional to velocity
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
        // Player sprints after ball, exits screen left
        this.px -= 5.8;
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
    const gY = this.gY;
    this.drawBall(ctx, gY);
    if (this.phase !== 'ball_enter' && this.phase !== 'wait') {
      this.drawPlayer(ctx, gY);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, gY: number): void {
    const r    = this.BALL_R;
    const by   = Math.min(this.by, gY - r);
    const airH = (gY - r) - by;
    const ss   = Math.max(0.18, 1 - airH / 100);

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.22 * ss;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(this.bx, gY + 2, r * ss * 1.1, 2.5 * ss, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ball body
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.bx, by, r, 0, Math.PI * 2);
    ctx.fill();

    // Pentagon-style panel lines
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

  private drawPlayer(ctx: CanvasRenderingContext2D, gY: number): void {
    const x  = this.px;
    const s  = 0.92;
    const pf = this.phaseFrame;

    const ankleY = gY - 8  * s;
    const kneeY  = gY - 30 * s;
    const hipY   = gY - 48 * s;
    const shldrY = gY - 70 * s;
    const headY  = gY - 84 * s;

    // Determine animation mode
    let run  = 0;   // leg oscillation
    let lean = 0;   // forward lean offset for head/shoulder
    let kickT = 0;  // kicking leg sweep [−1 back … +1 forward]
    let speed: 'slow' | 'normal' | 'fast' = 'normal';
    let paused = false;

    switch (this.phase) {
      case 'player_enter': {
        const t = clamp(pf / PLAYER_ENTER_F, 0, 1);
        run   = Math.sin(pf * 0.35) * 13 * s;
        speed = t > 0.75 ? 'slow' : 'normal';
        break;
      }
      case 'runup_back': {
        if (pf <= 12) {
          // Pause — slight weight shift
          paused = true;
          run    = Math.sin(pf * 0.18) * 3 * s;
        } else {
          // Backward shuffle — slow deliberate steps, same visual as forward run
          run   = Math.sin((pf - 12) * 0.22) * 9 * s;
          speed = 'slow';
        }
        break;
      }
      case 'runup_charge': {
        const t = clamp(pf / RUNUP_CHARGE_F, 0, 1);
        run   = Math.sin(pf * 0.42) * (12 + t * 6) * s;
        lean  = t * 6 * s;
        speed = 'fast';
        break;
      }
      case 'kick': {
        // Approach stride for first ~8 frames, then kick swing
        if (pf < 8) {
          run  = Math.sin(pf * 0.42) * 16 * s;
          lean = 6 * s;
        } else {
          lean = 8 * s;
          // backswing frames 8-12, then forward sweep frames 12-20
          if (pf < 12) {
            kickT = -Math.sin(((pf - 8) / 4) * Math.PI * 0.5) * 0.6;
          } else if (pf < 22) {
            kickT = Math.sin(((pf - 12) / 10) * Math.PI);
          } else {
            // follow-through decay
            kickT = Math.max(0, 1 - (pf - 22) / 10) * 0.3;
          }
        }
        break;
      }
      case 'chase': {
        run   = Math.sin(pf * 0.44) * 16 * s;
        lean  = 8 * s;
        speed = 'fast';
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

    if (kickT !== 0 || (this.phase === 'kick' && pf >= 8)) {
      // ── KICK POSE ─────────────────────────────────────────────────────────
      // Standing leg (right leg, away from ball)
      seg(ctx,
        x+5*s, hipY,
        x+10*s, kneeY,
        x+8*s,  ankleY + 4*s,
        5*s, 2.5*s,
      );
      // Kicking leg sweeps forward-left
      const kKneeX  = x - 10*s - kickT * 14 * s;
      const kKneeY  = kneeY     + (kickT < 0 ? kickT * 6 * s : 0);
      const kAnkleX = x - 16*s - kickT * 32 * s;
      const kAnkleY = ankleY   + (kickT > 0 ? kickT * 10 * s : kickT * 4 * s);
      seg(ctx,
        x-5*s, hipY,
        kKneeX, kKneeY,
        kAnkleX, kAnkleY,
        5*s, 2.5*s,
      );
    } else if (paused) {
      // ── STANDING / WEIGHT-SHIFT ───────────────────────────────────────────
      seg(ctx, x-4*s, hipY, x-8*s,  kneeY + run, x-6*s, ankleY + run*0.5, 5*s, 2.5*s);
      seg(ctx, x+4*s, hipY, x+8*s,  kneeY - run, x+6*s, ankleY - run*0.5, 5*s, 2.5*s);
    } else {
      // ── RUNNING LEGS ─────────────────────────────────────────────────────
      seg(ctx,
        x-5*s, hipY,
        x - 14*s, kneeY + run,
        x - 12*s, ankleY + run * 0.5,
        5*s, 2.5*s,
      );
      seg(ctx,
        x+5*s, hipY,
        x + 12*s, kneeY - run,
        x + 10*s, ankleY - run * 0.5,
        5*s, 2.5*s,
      );
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

    if (kickT !== 0 || (this.phase === 'kick' && pf >= 8)) {
      // Arms spread for balance during kick
      const armSpread = Math.abs(kickT) * 14 * s;
      const lHX = x - 16*s - armSpread, lHY = shY + 15*s;
      const lEX = (shX + lHX) * 0.5 - 4*s, lEY = (shY + lHY) * 0.5 + 3*s;
      seg(ctx, shX, shY, lEX, lEY, lHX, lHY, 4*s, 2*s);

      const rHX = x + 16*s + armSpread, rHY = shY + 15*s;
      const rEX = (shX + rHX) * 0.5 + 4*s, rEY = (shY + rHY) * 0.5 + 3*s;
      seg(ctx, shX, shY, rEX, rEY, rHX, rHY, 4*s, 2*s);
    } else {
      const lHX = x - 15*s, lHY = shY + 20*s + run * 0.35;
      const lEX = (shX + lHX) * 0.5 - 4*s, lEY = (shY + lHY) * 0.5 + 3*s;
      seg(ctx, shX, shY, lEX, lEY, lHX, lHY, 4*s, 2*s);

      const rHX = x + 13*s, rHY = shY + 20*s - run * 0.35;
      const rEX = (shX + rHX) * 0.5 + 4*s, rEY = (shY + rHY) * 0.5 + 3*s;
      seg(ctx, shX, shY, rEX, rEY, rHX, rHY, 4*s, 2*s);
    }

    // Head — leaning forward with player
    ctx.beginPath();
    ctx.arc(shldrX, headY, 9 * s, 0, Math.PI * 2);
    ctx.fill();

    // Speed lines during fast phases (chase + charge)
    if (speed === 'fast' && this.frame % 8 < 3) {
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
