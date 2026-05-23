import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppStateService } from '../services/app-state.service';
import { FrameState, compose, roll, ollie, kickflip, shuvit, handstand } from './skate-moves';

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

    const sequence = compose(
      roll(50), ollie, roll(40),
      kickflip, roll(30), shuvit,
      roll(30), handstand, roll(40),
    );
    const TOTAL = sequence.duration;

    type TrailFrame = { x: number; state: FrameState; f: number };
    const trail: TrailFrame[] = [];

    let f = 0;
    let prevJH = 0;
    let landingFrame = -999;

    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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

    const drawDust = (x: number): void => {
      const since = f - landingFrame;
      if (since < 0 || since >= 18) return;
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
    };

    const drawSkater = (x: number, state: FrameState, frame: number, alpha: number): void => {
      const { jh, crouch: crouchAmt, boardKickflip, boardShuv, handstand: hs } = state;
      const base = GROUND_Y - jh;
      const squat = crouchAmt * 14;
      const isAir = jh > 5;

      const airTuck = isAir ? Math.sin((jh / MAX_JH) * Math.PI) * 8 : 0;

      // Upright joint Y positions
      const uprightAnkleY    = base - 8  - airTuck * 0.5;
      const uprightKneeY     = base - 22 + squat * 0.5 - airTuck;
      const uprightHipY      = base - 34 + squat       - airTuck * 0.6;
      const uprightShoulderY = base - 52 + squat * 0.7 - airTuck * 0.3;
      const uprightHeadY     = base - 64 + squat * 0.5 - airTuck * 0.2;

      // Inverted joint Y positions (hands on board at GROUND_Y, feet pointing up)
      const invAnkleY    = GROUND_Y - 74;
      const invKneeY     = GROUND_Y - 60;
      const invHipY      = GROUND_Y - 44;
      const invShoulderY = GROUND_Y - 22;
      const invHeadY     = GROUND_Y - 8;

      const ankleY    = lerp(uprightAnkleY,    invAnkleY,    hs);
      const kneeY     = lerp(uprightKneeY,     invKneeY,     hs);
      const hipY      = lerp(uprightHipY,      invHipY,      hs);
      const shoulderY = lerp(uprightShoulderY, invShoulderY, hs);
      const headY     = lerp(uprightHeadY,     invHeadY,     hs);

      const lean = (isAir || hs > 0) ? 0 : Math.sin(frame * 0.15) * 1.5;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Shadow
      const shadowScale = Math.max(0.3, 1 - jh / (MAX_JH * 1.4));
      ctx.save();
      ctx.globalAlpha = alpha * 0.35 * shadowScale;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y + 4, 22 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Board
      ctx.save();
      ctx.translate(x, base);
      ctx.rotate(boardShuv);
      const flipScale = Math.cos(boardKickflip);
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

      // Legs
      ctx.beginPath();
      ctx.moveTo(x - 5 + lean, hipY);
      ctx.quadraticCurveTo(x - 13 + lean, kneeY, x - 11, ankleY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 5 + lean, hipY);
      ctx.quadraticCurveTo(x + 11 + lean, kneeY, x + 9, ankleY);
      ctx.stroke();

      // Torso
      ctx.beginPath();
      ctx.moveTo(x + lean * 0.8, hipY);
      ctx.lineTo(x - 3 + lean, shoulderY);
      ctx.stroke();

      // Arms
      ctx.lineWidth = 4;
      if (hs > 0.05) {
        // Handstand: arms reach straight down to support weight on the board
        const handY = lerp(shoulderY + 16, GROUND_Y - 4, hs);
        ctx.beginPath();
        ctx.moveTo(x - 3 + lean, shoulderY + 5);
        ctx.lineTo(x - 10, handY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 3 + lean, shoulderY + 5);
        ctx.lineTo(x + 8, handY);
        ctx.stroke();
      } else if (isAir) {
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

      // Head
      ctx.beginPath();
      ctx.arc(x - 3 + lean, headY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      drawScene();

      const x = getX(f);
      const state = sequence.getState(f);

      if (prevJH > 5 && state.jh <= 5) landingFrame = f;
      prevJH = state.jh;

      trail.push({ x, state, f });
      if (trail.length > 4) trail.shift();

      if (state.jh > 10) {
        for (let i = 0; i < trail.length - 1; i++) {
          const t = trail[i];
          drawSkater(t.x, t.state, t.f, 0.08 + i * 0.04);
        }
      }

      drawDust(x);
      drawSkater(x, state, f, 1);

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
