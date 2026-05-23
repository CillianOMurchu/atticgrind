import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-skate',
  standalone: true,
  template: `<canvas #skateCanvas class="skate-canvas"></canvas>`,
  styles: [`
    .skate-canvas {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      width: 100vw;
      height: 100vh;
    }
  `],
})
export class SkateComponent implements OnInit, OnDestroy {
  @ViewChild('skateCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly appState = inject(AppStateService);
  private readonly subs = new Subscription();
  private rafId = 0;

  ngOnInit(): void {
    this.subs.add(this.appState.skate$.subscribe(() => this.play()));
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.subs.unsubscribe();
  }

  play(): void {
    if (this.rafId) return;
    this.runAnimation();
  }

  private runAnimation(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const ROAD_H = 110;
    const GROUND_Y = H - ROAD_H;
    const MAX_JH = 110;

    const TOTAL = 360;

    type Trick = { name: string; start: number; end: number; type: 'air' | 'roll' };
    const tricks: Trick[] = [
      { name: 'push',     start: 0,   end: 50,  type: 'roll' },
      { name: 'ollie',    start: 60,  end: 130, type: 'air'  },
      { name: 'roll',     start: 130, end: 170, type: 'roll' },
      { name: 'kickflip', start: 175, end: 245, type: 'air'  },
      { name: 'roll',     start: 245, end: 280, type: 'roll' },
      { name: 'shuv',     start: 285, end: 350, type: 'air'  },
    ];

    type TrailFrame = {
      x: number; jh: number; crouch: number;
      kickflip: number; shuv: number; f: number;
    };
    const trail: TrailFrame[] = [];

    let f = 0;

    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const progress = (frame: number, start: number, end: number): number => {
      if (frame < start || frame > end) return -1;
      return (frame - start) / (end - start);
    };

    const getJH = (frame: number): number => {
      for (const t of tricks) {
        if (t.type !== 'air') continue;
        const p = progress(frame, t.start, t.end);
        if (p >= 0 && p <= 1) return Math.sin(p * Math.PI) * MAX_JH;
      }
      return 0;
    };

    const getCrouch = (frame: number): number => {
      const WIND = 12;
      const LAND = 14;
      for (const t of tricks) {
        if (t.type !== 'air') continue;
        if (frame >= t.start - WIND && frame < t.start)
          return (frame - (t.start - WIND)) / WIND;
        if (frame >= t.end && frame < t.end + LAND)
          return 1 - (frame - t.end) / LAND;
      }
      return 0;
    };

    const getBoardRotation = (frame: number): { kickflip: number; shuv: number } => {
      let kickflip = 0;
      let shuv = 0;
      const kf = tricks.find(t => t.name === 'kickflip')!;
      const kfP = progress(frame, kf.start, kf.end);
      if (kfP >= 0 && kfP <= 1) kickflip = kfP * Math.PI * 2;
      const sh = tricks.find(t => t.name === 'shuv')!;
      const shP = progress(frame, sh.start, sh.end);
      if (shP >= 0 && shP <= 1) shuv = shP * Math.PI * 2;
      return { kickflip, shuv };
    };

    const getX = (frame: number): number => {
      const t = frame / TOTAL;
      return -60 + (W + 120) * easeInOutCubic(t);
    };

    const drawScene = (): void => {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a0a14');
      grad.addColorStop(0.6, '#050508');
      grad.addColorStop(1, '#020203');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#010102';
      ctx.fillRect(0, GROUND_Y, W, ROAD_H);

      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();

      ctx.setLineDash([40, 28]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + ROAD_H * 0.55);
      ctx.lineTo(W, GROUND_Y + ROAD_H * 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawDust = (x: number, frame: number): void => {
      for (const t of tricks) {
        if (t.type !== 'air') continue;
        const since = frame - t.end;
        if (since >= 0 && since < 18) {
          const fade = 1 - since / 18;
          ctx.save();
          ctx.strokeStyle = `rgba(255,255,255,${fade * 0.5})`;
          ctx.lineWidth = 1;
          for (let i = 0; i < 6; i++) {
            const angle = -Math.PI + (i / 5) * Math.PI;
            const len = 8 + since * 0.8 + i * 1.5;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * 12, GROUND_Y);
            ctx.lineTo(x + Math.cos(angle) * (12 + len), GROUND_Y + Math.sin(angle) * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    };

    const drawSkater = (
      x: number, jh: number, crouch: number,
      boardRot: { kickflip: number; shuv: number },
      frame: number, alpha: number,
    ): void => {
      const base = GROUND_Y - jh;
      const squat = crouch * 14;
      const isAir = jh > 5;

      const airTuck = isAir ? Math.sin((jh / MAX_JH) * Math.PI) * 8 : 0;
      const ankleY    = base - 8  - airTuck * 0.5;
      const kneeY     = base - 22 + squat * 0.5 - airTuck;
      const hipY      = base - 34 + squat       - airTuck * 0.6;
      const shoulderY = base - 52 + squat * 0.7 - airTuck * 0.3;
      const headY     = base - 64 + squat * 0.5 - airTuck * 0.2;

      const lean = isAir ? 0 : Math.sin(frame * 0.15) * 1.5;

      ctx.save();
      ctx.globalAlpha = alpha;

      const shadowScale = Math.max(0.3, 1 - jh / (MAX_JH * 1.4));
      ctx.save();
      ctx.globalAlpha = alpha * 0.35 * shadowScale;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y + 4, 22 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, base);
      ctx.rotate(boardRot.shuv);
      const flipScale = Math.cos(boardRot.kickflip);
      ctx.scale(1, flipScale);
      ctx.fillStyle = flipScale < 0 ? '#bbb' : '#fff';
      ctx.fillRect(-19, -4, 38, 6);
      ctx.beginPath();
      ctx.arc(-13, 3, 3.5, 0, Math.PI * 2);
      ctx.arc(13,  3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.moveTo(x - 5 + lean, hipY);
      ctx.quadraticCurveTo(x - 13 + lean, kneeY, x - 11, ankleY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 5 + lean, hipY);
      ctx.quadraticCurveTo(x + 11 + lean, kneeY, x + 9, ankleY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + lean * 0.8, hipY);
      ctx.lineTo(x - 3 + lean, shoulderY);
      ctx.stroke();

      ctx.lineWidth = 4;
      if (isAir) {
        const airP = jh / MAX_JH;
        const swing = Math.sin(airP * Math.PI);
        ctx.beginPath();
        ctx.moveTo(x - 3 + lean, shoulderY + 5);
        ctx.lineTo(x - 18 - swing * 4, shoulderY - 8 - swing * 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 3 + lean, shoulderY + 5);
        ctx.lineTo(x + 16 + swing * 4, shoulderY - 2 - swing * 4);
        ctx.stroke();
      } else {
        const armSwing = Math.sin(frame * 0.18) * 4;
        ctx.beginPath();
        ctx.moveTo(x - 3 + lean, shoulderY + 5);
        ctx.lineTo(x - 14 + lean, shoulderY + 16 + armSwing);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 3 + lean, shoulderY + 5);
        ctx.lineTo(x + 10 + lean, shoulderY + 16 - armSwing);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x - 3 + lean, headY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      drawScene();

      const x = getX(f);
      const jh = getJH(f);
      const crouch = getCrouch(f);
      const boardRot = getBoardRotation(f);

      trail.push({ x, jh, crouch, kickflip: boardRot.kickflip, shuv: boardRot.shuv, f });
      if (trail.length > 4) trail.shift();

      if (jh > 10) {
        for (let i = 0; i < trail.length - 1; i++) {
          const t = trail[i];
          drawSkater(
            t.x, t.jh, t.crouch,
            { kickflip: t.kickflip, shuv: t.shuv },
            t.f, 0.08 + i * 0.04,
          );
        }
      }

      drawDust(x, f);
      drawSkater(x, jh, crouch, boardRot, f, 1);

      f++;
      if (f > TOTAL) {
        ctx.clearRect(0, 0, W, H);
        this.rafId = 0;
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
