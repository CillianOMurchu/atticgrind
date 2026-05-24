import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppStateService } from '../services/app-state.service';
import { Footballer } from './footballer';
import { Skater } from './skater';
import { SKATER_PROFILES } from './skater-profiles';

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
  private skatersTimerId = 0;
  private skaters: Skater[] = [];
  private footballer: Footballer | null = null;

  ngOnInit(): void {
    this.skatersTimerId = window.setTimeout(() => this.playSkaters(), 2_000);
    this.subs.add(
      this.appState.footballerTrigger$.subscribe(() => this.playFootballer())
    );
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    clearTimeout(this.skatersTimerId);
    this.subs.unsubscribe();
  }

  private scheduleSkaters(): void {
    this.skatersTimerId = window.setTimeout(() => this.playSkaters(), 40_000);
  }

  private playSkaters(): void {
    if (this.rafId) { this.scheduleSkaters(); return; }
    this.runSkatersAnimation();
  }

  private playFootballer(): void {
    if (this.rafId) return; // animation already running, ignore
    this.runFootballerAnimation();
  }

  private setup(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; W: number; H: number; GROUND_Y: number } | null {
    const canvas = this.canvasRef.nativeElement;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx, W: canvas.width, H: canvas.height, GROUND_Y: canvas.height - 110 };
  }

  private runSkatersAnimation(): void {
    const s = this.setup();
    if (!s) return;
    const { ctx, W, H, GROUND_Y } = s;
    const MAX_JH = 110;

    this.skaters = [...SKATER_PROFILES]
      .sort((a, b) => b.laneOffset - a.laneOffset)
      .map(p => new Skater(p));

    let f = 0;
    const fg       = this.skaters[this.skaters.length - 1];
    const fontSize = Math.min(Math.floor(W * 0.075), 130);
    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const drawBirthdayText = (revealX: number): void => {
      ctx.save();
      ctx.font = `900 ${fontSize}px Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, revealX, H);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'rgba(180, 200, 255, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(200, 215, 235, 0.95)';
      ctx.restore();
      ctx.restore();
    };

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);

      const lf       = f - fg.config.delay;
      const progress = Math.max(0, Math.min(1, lf / fg.config.sequence.duration));
      drawBirthdayText(-60 + (W + 120) * easeInOutCubic(progress));

      for (const skater of this.skaters) {
        skater.draw(ctx, f, W, GROUND_Y - skater.config.laneOffset, MAX_JH);
      }

      f++;

      if (this.skaters.every(sk => sk.isDone(f))) {
        ctx.clearRect(0, 0, W, H);
        this.rafId = 0;
        this.scheduleSkaters();
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private runFootballerAnimation(): void {
    const s = this.setup();
    if (!s) return;
    const { canvas, ctx, W, H, GROUND_Y } = s;

    // Measure 'i' position using the same font/layout as rain.component's draw3DText()
    const fontSize = Math.min(Math.max(W * 0.22, 120), 400);
    ctx.font = `900 ${fontSize}px Roboto`;
    const totalW = ctx.measureText('Atticus').width;
    const preW   = ctx.measureText('Att').width;
    const iW     = ctx.measureText('i').width;
    const iDotX  = W / 2 - totalW / 2 + preW + iW / 2;
    const iDotY  = H * (4 / 5) - fontSize * 0.38;

    this.footballer = new Footballer(W, GROUND_Y, iDotX, iDotY);

    const tick = (): void => {
      ctx.clearRect(0, 0, W, canvas.height);

      if (this.footballer) {
        this.footballer.update();
        this.footballer.draw(ctx);
      }

      if (!this.footballer || this.footballer.isDone()) {
        ctx.clearRect(0, 0, W, canvas.height);
        this.rafId = 0;
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
