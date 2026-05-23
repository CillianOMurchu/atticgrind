import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppStateService } from '../services/app-state.service';
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

    const drawScene = (): void => {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   '#0a0a14');
      grad.addColorStop(0.6, '#050508');
      grad.addColorStop(1,   '#020203');
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
      ctx.moveTo(0, GROUND_Y + ROAD_H * 0.55); ctx.lineTo(W, GROUND_Y + ROAD_H * 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      drawScene();

      for (const skater of skaters) {
        skater.draw(ctx, f, W, GROUND_Y - skater.config.laneOffset, MAX_JH);
      }

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
