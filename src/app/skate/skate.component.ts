import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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

  private rafId = 0;
  private timerId = 0;

  ngOnInit(): void {
    this.scheduleNext();
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    clearTimeout(this.timerId);
  }

  private scheduleNext(): void {
    const delay = 10_000 + Math.random() * 5_000;
    this.timerId = window.setTimeout(() => this.play(), delay);
  }

  private play(): void {
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
    const ROAD_H   = 110;
    const GROUND_Y = H - ROAD_H;
    const MAX_JH   = 110;

    // Sort deepest-first so foreground renders on top
    const skaters = [...SKATER_PROFILES]
      .sort((a, b) => b.laneOffset - a.laneOffset)
      .map(p => new Skater(p));

    const TOTAL = Math.max(...skaters.map(s => s.totalFrames));
    let f = 0;

    // Foreground skater (lowest laneOffset after sort) drives the text reveal
    const fg         = skaters[skaters.length - 1];
    const fontSize   = Math.min(Math.floor(W * 0.075), 130);
    const textY      = GROUND_Y * 0.42;

    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const drawBirthdayText = (revealX: number): void => {
      ctx.save();
      ctx.font = `900 ${fontSize}px Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dim ghost — hints text exists before reveal
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#fff';
      ctx.fillText('Happy Birthday', W / 2, textY);

      // Clipped reveal — expands left-to-right with the foreground skater
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, revealX, H);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'rgba(180, 200, 255, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(200, 215, 235, 0.95)';
      ctx.fillText('Happy Birthday', W / 2, textY);
      ctx.restore();

      ctx.restore();
    };

    const drawScene = (): void => {};

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      drawScene();

      const lf      = f - fg.config.delay;
      const progress = Math.max(0, Math.min(1, lf / fg.config.sequence.duration));
      const revealX  = -60 + (W + 120) * easeInOutCubic(progress);
      drawBirthdayText(revealX);

      for (const skater of skaters) {
        skater.draw(ctx, f, W, GROUND_Y - skater.config.laneOffset, MAX_JH);
      }

      f++;
      if (f > TOTAL) {
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
