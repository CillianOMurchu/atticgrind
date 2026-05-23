import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BANNER_MESSAGE } from '../skate/banner-message';

@Component({
  selector: 'app-banner',
  standalone: true,
  template: `<canvas #bannerCanvas class="banner-canvas"></canvas>`,
  styles: [`
    .banner-canvas {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 4;
      width: 100vw;
      height: 100vh;
    }
  `],
})
export class BannerComponent implements OnInit, OnDestroy {
  @ViewChild('bannerCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private rafId = 0;
  private timerId = 0;

  ngOnInit(): void {
    this.timerId = window.setTimeout(() => this.run(), 8_000 + Math.random() * 4_000);
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    clearTimeout(this.timerId);
  }

  private scheduleNext(): void {
    const delay = 30_000;
    this.timerId = window.setTimeout(() => this.run(), delay);
  }

  private run(): void {
    if (this.rafId) {
      this.scheduleNext();
      return;
    }
    this.runAnimation();
  }

  private runAnimation(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W        = canvas.width;
    const H        = canvas.height;
    const GROUND_Y = H - 110;

    const FONT_SIZE = 26;
    ctx.font = `700 ${FONT_SIZE}px Roboto, sans-serif`;
    const TEXT_W    = ctx.measureText(BANNER_MESSAGE).width;
    const PAD_X     = 44;
    const BANNER_W  = TEXT_W + PAD_X * 2;
    const BANNER_H  = 44;
    const BACK_OFFSET = 18; // pixels behind skater where banner attaches

    const SPEED = 4;
    const TOTAL = Math.ceil((W + 80 + BACK_OFFSET + BANNER_W) / SPEED) + 10;

    let f = 0;

    // Waves propagate rightward (away from skater). Top and bottom edges use
    // different phases so the banner visibly twists — otherwise it just translates.
    const FREQ        = 1.4;
    const PHASE_SPEED = 0.10;
    const MAX_AMP     = 26;
    const TWIST       = 0.45; // radians phase offset between top and bottom edges

    const edgeWave = (t: number, phase: number): number =>
      Math.sin(t * FREQ * Math.PI * 2 - f * PHASE_SPEED + phase) * t * MAX_AMP;

    // Average center — used to position text and skater arm
    const centerAt = (t: number): number =>
      (edgeWave(t, 0) + edgeWave(t, TWIST)) / 2;

    const drawBanner = (attachX: number, baseCenterY: number): void => {
      const SEGS = 40;
      const topPts: { x: number; y: number }[] = [];
      const botPts: { x: number; y: number }[] = [];

      for (let i = 0; i <= SEGS; i++) {
        const t  = i / SEGS;
        const px = attachX + t * BANNER_W;
        topPts.push({ x: px, y: baseCenterY - BANNER_H / 2 + edgeWave(t, 0) });
        botPts.push({ x: px, y: baseCenterY + BANNER_H / 2 + edgeWave(t, TWIST) });
      }

      // Shaded strips: when top is high and bottom is low the fabric faces the
      // viewer (bright); when both move together it's angled away (dark).
      for (let i = 0; i < SEGS; i++) {
        const stripH = ((botPts[i].y   + botPts[i + 1].y) -
                        (topPts[i].y   + topPts[i + 1].y)) / 2;
        const norm   = Math.max(0, Math.min(1, stripH / BANNER_H));
        const bright = 0.60 + norm * 0.33;
        ctx.beginPath();
        ctx.moveTo(topPts[i].x,     topPts[i].y);
        ctx.lineTo(topPts[i + 1].x, topPts[i + 1].y);
        ctx.lineTo(botPts[i + 1].x, botPts[i + 1].y);
        ctx.lineTo(botPts[i].x,     botPts[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgba(220, 232, 255, ${bright.toFixed(2)})`;
        ctx.fill();
      }

      // Edge lines
      ctx.save();
      ctx.strokeStyle = 'rgba(140, 170, 220, 0.45)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(topPts[0].x, topPts[0].y);
      for (let i = 1; i <= SEGS; i++) ctx.lineTo(topPts[i].x, topPts[i].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(botPts[0].x, botPts[0].y);
      for (let i = 1; i <= SEGS; i++) ctx.lineTo(botPts[i].x, botPts[i].y);
      ctx.stroke();
      ctx.restore();

      // Text: each character follows the banner's centre line at its x position
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(topPts[0].x, topPts[0].y);
      for (let i = 1; i <= SEGS; i++) ctx.lineTo(topPts[i].x, topPts[i].y);
      for (let i = SEGS; i >= 0; i--) ctx.lineTo(botPts[i].x, botPts[i].y);
      ctx.closePath();
      ctx.clip();
      ctx.font = `700 ${FONT_SIZE}px Roboto, sans-serif`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = 'rgba(20, 40, 90, 0.88)';
      let charX = attachX + PAD_X;
      for (const ch of BANNER_MESSAGE) {
        const t  = Math.max(0, Math.min(1, (charX - attachX) / BANNER_W));
        const cy = baseCenterY + centerAt(t);
        ctx.fillText(ch, charX, cy);
        charX += ctx.measureText(ch).width;
      }
      ctx.restore();
    };

    const seg = (
      x1: number, y1: number,
      jx: number, jy: number,
      x2: number, y2: number,
      lw: number, jr: number,
    ): void => {
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(jx, jy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(x2, y2); ctx.stroke();
      if (jr > 0) { ctx.beginPath(); ctx.arc(jx, jy, jr, 0, Math.PI * 2); ctx.fill(); }
    };

    const drawSkater = (x: number, groundY: number): void => {
      const s         = 1.0;
      const step      = Math.sin(f * 0.32) * 10 * s;
      const ankleY    = groundY - 8  * s;
      const kneeY     = groundY - 24 * s;
      const hipY      = groundY - 36 * s;
      const shldrX    = x + 3 * s;
      const shldrY    = groundY - 54 * s;
      const headY     = groundY - 66 * s;
      const bannerCY  = groundY - 60;

      ctx.save();

      // Shadow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle   = '#000';
      ctx.beginPath();
      ctx.ellipse(x, groundY + 4, 22 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Board
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 19 * s, groundY - 4 * s, 38 * s, 6 * s);
      ctx.beginPath();
      ctx.arc(x - 13 * s, groundY + 3 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc(x + 13 * s, groundY + 3 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fff';
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.lineWidth   = 5 * s;

      // Legs — mirrored for left-facing skater
      seg(x-5*s, hipY,  x-13*s, kneeY+step,  x-11*s, ankleY+step*0.5,  5*s, 2.5*s);
      seg(x+5*s, hipY,  x+11*s, kneeY-step,  x+9*s,  ankleY-step*0.5,  5*s, 2.5*s);

      // Torso
      ctx.beginPath();
      ctx.moveTo(x, hipY);
      ctx.lineTo(shldrX, shldrY);
      ctx.stroke();

      ctx.lineWidth = 4 * s;

      // Forward arm (left — direction of travel)
      const armSwing = Math.sin(f * 0.18) * 4 * s;
      const faHX = x - 14*s, faHY = shldrY + 16*s + armSwing;
      const faEX = (shldrX + faHX) * 0.5 - 4*s, faEY = (shldrY+5*s + faHY) * 0.5 + 3*s;
      seg(shldrX, shldrY+5*s,  faEX, faEY,  faHX, faHY,  4*s, 2*s);

      // Trailing arm — extends right to hold the banner rope
      const taHX = x + BACK_OFFSET + 3, taHY = bannerCY + centerAt(0);
      const taEX = (shldrX + taHX) * 0.5 + 4*s, taEY = (shldrY+5*s + taHY) * 0.5 + 3*s;
      seg(shldrX, shldrY+5*s,  taEX, taEY,  taHX, taHY,  4*s, 2*s);

      // Head
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(shldrX, headY, 8 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);

      const skaterX   = W + 60 - SPEED * f;
      const attachX   = skaterX + BACK_OFFSET;
      const bannerCY  = GROUND_Y - 60;

      drawBanner(attachX, bannerCY);

      if (skaterX > -80) {
        drawSkater(skaterX, GROUND_Y);
      }

      f++;

      if (f >= TOTAL) {
        ctx.clearRect(0, 0, W, H);
        this.rafId = 0;
        this.scheduleNext();
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
