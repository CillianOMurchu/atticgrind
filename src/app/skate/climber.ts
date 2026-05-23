// Climbing cycle (CYCLE frames):
//   0-16  swing  — active arm arcs axe from low/pulled-back up to a high wall plant
//  16-20  impact — axe embeds, sparks
//  20-44  pull   — body rises fast, both grips descend in body-relative space
//  44-52  reset  — active arm pulls back; passive arm repositions for next cycle
const CYCLE = 52;

/** Eases t ∈ [0,1] with a smooth in-out curve. */
function eio(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Compute an elbow/knee joint position that bends perpendicular to the
 * start→end segment, always displaced in the +X direction (rightward,
 * away from the wall).
 */
function joint(
  sx: number, sy: number,
  ex: number, ey: number,
  bend: number,
): [number, number] {
  const mx = (sx + ex) * 0.5;
  const my = (sy + ey) * 0.5;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // CCW perpendicular: rotate (dx,dy) 90° CCW → (-dy, dx)
  let px = -dy / len;
  let py =  dx / len;
  // Flip so the joint always goes rightward (away from wall)
  if (px < 0) { px = -px; py = -py; }
  return [mx + px * bend, my + py * bend];
}

/** Draw a two-segment limb through a pre-computed joint, with a dot at the joint. */
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

export class Climber {
  private frame = 0;
  private y: number;  // hip y-position; decreases as climber ascends

  constructor(startY: number) {
    this.y = startY;
  }

  isDone(): boolean { return this.y < -160; }

  update(): void {
    this.frame++;
    const ph = this.frame % CYCLE;
    if (ph >= 20 && ph < 44) {
      this.y -= 3.4;   // fast pull-up after axe plants
    } else if (ph >= 16 && ph < 20) {
      this.y -= 0.25;  // near-pause on impact
    } else {
      this.y -= 1.0;   // slow drift while swinging / resetting
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const y  = this.y;
    const f  = this.frame;
    const ph = f % CYCLE;

    const isSwing  = ph < 16;
    const isImpact = ph >= 16 && ph < 20;
    const isPull   = ph >= 20 && ph < 44;
    const isReset  = ph >= 44;

    const swingE = isSwing ? eio(ph / 16)                         : 0;
    const pullE  = isPull  ? eio((ph - 20) / 24)                  : 0;
    const resetE = isReset ? eio((ph - 44) / (CYCLE - 44))        : 0;

    const WALL   = 4;   // x of the wall surface
    const BODY_X = 28;  // x of hip / torso axis

    // Body leans very slightly toward the wall during pull
    const sway = isPull ? -2 * Math.sin(pullE * Math.PI) : 0;

    const hipX   = BODY_X + sway;
    const hipY   = y;
    const shldrX = BODY_X - 2 + sway;
    const shldrY = y - 20;
    const headX  = BODY_X + 7 + sway * 0.4;
    const headY  = y - 33;

    // ── Active (upper) arm — holds and swings the axe ─────────────────────
    // Swing: arc from low/pulled-back to high/planted on wall
    //   uhX: pulled 10px back from wall → at wall
    //   uhY: from shldrY+12 (below shoulder) → shldrY-22 (well above)
    // Pull: body rises; grip appears to descend in body-relative coords
    // Reset: arm withdraws from wall and sinks back to start position
    let uhX: number, uhY: number;
    if (isSwing) {
      uhX = WALL + 2 + (1 - swingE) * 10;
      uhY = shldrY + 12 - 34 * swingE;
    } else if (isImpact) {
      uhX = WALL + 2;
      uhY = shldrY - 22;
    } else if (isPull) {
      uhX = WALL + 2;
      uhY = shldrY - 22 + 38 * pullE;   // grip descends from -22 → +16 as body overtakes
    } else {
      uhX = WALL + 2 + resetE * 10;     // withdraws from wall
      uhY = shldrY + 16 - 4 * resetE;   // sinks slightly to +12 ready for next swing
    }

    // ── Passive (lower) arm — steady grip, repositions during reset ────────
    // This arm is half a cycle behind the active arm, giving an alternating look.
    // During pull: body overtakes this grip too, so it descends in body-relative
    // During reset: slides back up to ready position below shoulder
    let lhX: number, lhY: number;
    if (isSwing || isImpact) {
      lhX = WALL + 2;
      lhY = shldrY + 10;                // steady grip while active arm swings
    } else if (isPull) {
      lhX = WALL + 2;
      lhY = shldrY + 10 + 22 * pullE;  // descends from +10 → +32 as body rises
    } else {
      lhX = WALL + 2;
      lhY = shldrY + 32 - 22 * resetE; // slides back up to +10 during reset
    }

    // ── Feet — alternate stepping; body overtakes them during pull ─────────
    const footX    = WALL + 3;
    const footBase = isPull ? 20 * pullE : isReset ? 20 - 20 * resetE : 0;
    const wiggle   = Math.sin(f * 0.11) * 4;
    const foot1Y   = hipY + 24 + footBase + wiggle;
    const foot2Y   = hipY + 34 + footBase - wiggle;

    ctx.save();

    // Thin shadow hugging the wall
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(WALL, hipY + 28, 4, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Impact sparks at axe pick tip
    if (isImpact) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 6; i++) {
        const a   = -Math.PI * 0.88 + (i / 5) * Math.PI * 0.65;
        const len = 4 + i * 2;
        ctx.strokeStyle = i % 2 === 0 ? '#ffe566' : '#ff9933';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(uhX, uhY);
        ctx.lineTo(uhX + Math.cos(a) * len, uhY + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.strokeStyle = '#fff';
    ctx.fillStyle   = '#fff';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // ── Legs with knees ─────────────────────────────────────────────────────
    // joint() ensures knees bend rightward (away from wall)
    const [k1x, k1y] = joint(hipX, hipY, footX, foot1Y, 17);
    seg(ctx, hipX, hipY, k1x, k1y, footX, foot1Y, 5, 2.5);

    const [k2x, k2y] = joint(hipX, hipY, footX, foot2Y, 14);
    seg(ctx, hipX, hipY, k2x, k2y, footX, foot2Y, 5, 2.5);

    // ── Torso ────────────────────────────────────────────────────────────────
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shldrX, shldrY);
    ctx.stroke();

    // ── Arms with elbows ────────────────────────────────────────────────────
    // Upper (active) arm — elbow bends rightward
    const [ueX, ueY] = joint(shldrX, shldrY, uhX, uhY, 12);
    seg(ctx, shldrX, shldrY, ueX, ueY, uhX, uhY, 4, 2);

    // Lower (passive) arm — elbow bends rightward
    const [leX, leY] = joint(shldrX, shldrY, lhX, lhY, 10);
    seg(ctx, shldrX, shldrY, leX, leY, lhX, lhY, 4, 2);

    // ── Axe at the active hand ───────────────────────────────────────────────
    this.drawAxe(ctx, uhX, uhY, shldrX, shldrY, !isSwing);

    // ── Head and helmet ─────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(headX, headY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3ab0f0';
    ctx.beginPath();
    ctx.arc(headX, headY - 1, 8, -Math.PI * 0.95, 0.12, false);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Ice axe drawn at the active hand.
   * The handle runs from the grip back toward the shoulder; the pick
   * extends forward (toward/into the wall) from the grip.
   */
  private drawAxe(
    ctx: CanvasRenderingContext2D,
    hx: number, hy: number,   // hand / grip position
    sx: number, sy: number,   // shoulder (determines handle direction)
    planted: boolean,
  ): void {
    const dx  = sx - hx;
    const dy  = sy - hy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = dx / len;  // unit vector from hand toward shoulder (= handle direction)
    const ny  = dy / len;

    // Handle extends from hand back toward shoulder
    const handleTx = hx + nx * 14;
    const handleTy = hy + ny * 14;

    // Pick extends forward from hand (away from shoulder = into/toward wall)
    const pickTx = hx - nx * 7;
    const pickTy = hy - ny * 7;

    // Perpendicular for blade geometry
    const perpX =  ny;
    const perpY = -nx;

    ctx.save();

    // Handle
    ctx.strokeStyle = '#c8a060';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(pickTx, pickTy);
    ctx.lineTo(handleTx, handleTy);
    ctx.stroke();

    // Pick blade — brighter when planted to sell the embed
    ctx.fillStyle = planted ? '#ddeeff' : '#aabccc';
    ctx.beginPath();
    ctx.moveTo(pickTx, pickTy);
    ctx.lineTo(pickTx + perpX * 6 - nx * 5, pickTy + perpY * 6 - ny * 5);
    ctx.lineTo(pickTx - perpX * 3,           pickTy - perpY * 3);
    ctx.closePath();
    ctx.fill();

    // Adze (small blade on the back of the head)
    ctx.beginPath();
    ctx.moveTo(handleTx, handleTy);
    ctx.lineTo(handleTx + perpX * 4 + nx * 2, handleTy + perpY * 4 + ny * 2);
    ctx.lineTo(handleTx - perpX * 3,           handleTy - perpY * 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
