import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-rain',
  standalone: true,
  templateUrl: './rain.component.html',
  styleUrls: ['./rain.component.scss'],
})
export class RainComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rainCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly appState = inject(AppStateService);
  private readonly subs = new Subscription();
  private rafId = 0;
  private resizeListener = () => {};
  private changeTextFn: ((text: string) => void) | null = null;
  private setWeatherFn: ((w: number) => void) | null = null;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D;
    const hitCanvas = document.createElement('canvas');
    const hitCtx = hitCanvas.getContext('2d', {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D;
    const cloudCanvas = document.createElement('canvas');

    let width = 0;
    let height = 0;
    let drops: any[] = [];
    let splashes: any[] = [];
    let cloudLayers: any[] = [];
    let lightningBolts: any[] = [];
    let frameCount = 0;

    const dropCount = 1200;
    let textString = 'Atticus';

    const RAIN_ANGLE = 5;
    const rainAngleRad = (RAIN_ANGLE * Math.PI) / 180;
    const rainVelocityX = Math.sin(rainAngleRad);
    const rainVelocityY = Math.cos(rainAngleRad);

    let isLightning = false;
    let lightningTimer = 0;
    let lightningIntensity = 0;
    let hbFlicker = 0;
    let weather = 0; // 0 = full storm, 1 = sunny

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      hitCanvas.width = width;
      hitCanvas.height = height;
      cloudCanvas.width = width;
      cloudCanvas.height = Math.floor(height * 0.6);
      drawCollisionMap();
      initClouds();
    }

    function drawCollisionMap() {
      hitCtx.fillStyle = 'black';
      hitCtx.fillRect(0, 0, width, height);

      const fontSize = Math.min(Math.max(width * 0.22, 120), 400);
      hitCtx.font = `900 ${fontSize}px Roboto`;
      hitCtx.textAlign = 'center';
      hitCtx.textBaseline = 'middle';
      hitCtx.fillStyle = 'white';
      hitCtx.fillText(textString, width / 2, height * (4 / 5));
    }

    this.changeTextFn = (text: string) => {
      textString = text;
      drawCollisionMap();
    };

    this.subs.add(
      this.appState.text$.subscribe((text) =>
        this.changeTextFn?.(text || 'Atticus'),
      ),
    );

    function draw3DText() {
      const fontSize = Math.min(Math.max(width * 0.22, 120), 400);
      ctx.font = `900 ${fontSize}px Roboto`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cx = width / 2;
      const cy = height * (4 / 5);

      ctx.shadowColor = 'black';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 25;
      ctx.fillStyle = 'black';
      ctx.fillText(textString, cx, cy);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.fillStyle = '#222230';
      ctx.fillText(textString, cx + 5, cy + 5);

      const gradient = ctx.createLinearGradient(
        0,
        cy - fontSize / 2,
        0,
        cy + fontSize / 2,
      );
      gradient.addColorStop(0, '#252535');
      gradient.addColorStop(0.3, '#424260');
      gradient.addColorStop(0.5, '#1e1e2c');
      gradient.addColorStop(1, '#14141e');

      ctx.fillStyle = gradient;
      ctx.fillText(textString, cx, cy);

      ctx.save();
      ctx.shadowColor = isLightning
        ? 'rgba(200, 225, 255, 0.9)'
        : 'rgba(150, 180, 230, 0.5)';
      ctx.shadowBlur = isLightning ? 40 : 22;
      ctx.fillStyle = isLightning
        ? 'rgba(255,255,255,0.92)'
        : 'rgba(200,218,250,0.45)';
      ctx.fillText(textString, cx, cy - 1);
      ctx.restore();

      // Flashing red 'A' — first character of textString
      if (textString.length > 0) {
        const totalW  = ctx.measureText(textString).width;
        const firstCh = textString[0];
        const charX   = cx - totalW / 2;
        const pulse   = 0.5 + 0.5 * Math.sin(frameCount * 0.07);
        ctx.save();
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = `rgba(255, 20, 20, ${0.6 + pulse * 0.4})`;
        ctx.shadowBlur   = 16 + pulse * 32;
        ctx.fillStyle    = `rgba(${Math.round(200 + pulse * 55)}, ${Math.round(15 + pulse * 20)}, ${Math.round(15 + pulse * 20)}, ${0.8 + pulse * 0.2})`;
        ctx.fillText(firstCh, charX, cy - 1);
        ctx.restore();
      }
    }

    function createCloudTexture(size: number, brightness: number) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d') as CanvasRenderingContext2D;

      const centerX = size / 2;
      const centerY = size / 2;

      for (let i = 0; i < 3; i++) {
        const offsetX = (Math.random() - 0.5) * size * 0.3;
        const offsetY = (Math.random() - 0.5) * size * 0.3;
        const radius = size * (0.4 + Math.random() * 0.2);

        const gradient = tempCtx.createRadialGradient(
          centerX + offsetX,
          centerY + offsetY,
          0,
          centerX + offsetX,
          centerY + offsetY,
          radius,
        );

        const alpha = 0.15 + Math.random() * 0.1;
        gradient.addColorStop(
          0,
          `rgba(${brightness + 25}, ${brightness + 25}, ${brightness + 30}, ${alpha})`,
        );
        gradient.addColorStop(
          0.5,
          `rgba(${brightness}, ${brightness}, ${brightness + 15}, ${alpha * 0.6})`,
        );
        gradient.addColorStop(
          1,
          `rgba(${brightness - 10}, ${brightness - 10}, ${brightness}, 0)`,
        );

        tempCtx.fillStyle = gradient;
        tempCtx.fillRect(0, 0, size, size);
      }

      return tempCanvas;
    }

    class CloudLayer {
      depth!: number;
      speed!: number;
      offset!: number;
      y!: number;
      brightness!: number;
      cloudTextures!: any[];

      constructor(depth: number, yPos: number) {
        this.depth = depth;
        this.speed = 0.15 + depth * 0.25;
        this.offset = 0;
        this.y = yPos;
        this.brightness = 25 + depth * 15;
        this.cloudTextures = [];

        const numClouds = 5.5;
        for (let i = 0; i < numClouds; i++) {
          const size = 200 + Math.random() * 400;
          this.cloudTextures.push({
            texture: createCloudTexture(size, this.brightness),
            size,
            x: (i / numClouds) * width,
            offsetY: (Math.random() - 0.5) * 80,
          });
        }
      }

      update() {
        this.offset += this.speed;
        if (this.offset > width) {
          this.offset = 0;
        }
      }

      draw() {
        ctx.save();

        let alpha = 0.7 + this.depth * 0.3;
        if (isLightning && lightningIntensity > 0) {
          alpha = Math.min(1, alpha + lightningIntensity * 0.4);
        }
        ctx.globalAlpha = alpha;

        if (isLightning && lightningIntensity > 0) {
          ctx.globalCompositeOperation = 'lighter';
        }

        for (let loop = 0; loop < 2; loop++) {
          this.cloudTextures.forEach((cloud) => {
            const x = cloud.x - this.offset + loop * width * 2;
            const y = this.y + cloud.offsetY;
            if (x + cloud.size > -cloud.size && x < width + cloud.size) {
              ctx.drawImage(
                cloud.texture,
                x - cloud.size / 2,
                y - cloud.size / 2,
              );
            }
          });
        }

        ctx.restore();
      }
    }

    function initClouds() {
      cloudLayers = [];
      cloudLayers.push(new CloudLayer(0.3, height * 0.1));
      cloudLayers.push(new CloudLayer(0.6, height * 0.2));
      cloudLayers.push(new CloudLayer(1.0, height * 0.3));
    }

    class LightningBolt {
      segments!: any[];
      life!: number;
      brightness!: number;

      constructor() {
        this.segments = [];
        this.life = 1.0;
        this.brightness = Math.random() * 0.5 + 0.5;
        this.generateBolt();
      }

      generateBolt() {
        const startX = Math.random() * width;
        const startY = 0;
        const endX = startX + (Math.random() - 0.5) * 400;
        const endY = height * (Math.random() * 0.4 + 0.2);

        this.segments = this.createBranch(startX, startY, endX, endY, 1);

        if (Math.random() > 0.5) {
          const idx = Math.floor(this.segments.length * 0.6);
          const branchPoint = this.segments[idx];
          const branchEnd = {
            x: branchPoint.x + (Math.random() - 0.5) * 250,
            y: branchPoint.y + Math.random() * 150 + 50,
          };
          this.segments.push(
            ...this.createBranch(
              branchPoint.x,
              branchPoint.y,
              branchEnd.x,
              branchEnd.y,
              0.6,
            ),
          );
        }
      }

      createBranch(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        widthMult: number,
      ) {
        const segments: any[] = [];
        const steps = 10;
        let currentX = x1;
        let currentY = y1;

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const targetX = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 60;
          const targetY = y1 + (y2 - y1) * t;

          segments.push({
            x1: currentX,
            y1: currentY,
            x2: targetX,
            y2: targetY,
            width: (Math.random() * 2 + 1) * widthMult,
          });

          currentX = targetX;
          currentY = targetY;
        }

        return segments;
      }

      update() {
        this.life -= 0.12;
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = this.life * this.brightness;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(200, 220, 255, 0.8)';

        this.segments.forEach((seg) => {
          ctx.strokeStyle = 'rgba(180, 200, 255, 0.2)';
          ctx.lineWidth = seg.width * 10;
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
          ctx.lineWidth = seg.width * 1.5;
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        });

        ctx.restore();
      }
    }

    class Splash {
      x!: number;
      y!: number;
      vx!: number;
      vy!: number;
      life!: number;
      size!: number;

      constructor(x: number, y: number, impactAngle: number) {
        this.x = x;
        this.y = y;

        const baseAngle = -Math.PI / 2 - rainAngleRad;
        const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6;
        const angle = baseAngle + spreadAngle;
        const speed = Math.random() * 6 + 3;

        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.size = Math.random() * 2.5 + 0.5;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.5;
        this.vx *= 0.98;
        this.life -= 0.04;
      }

      draw() {
        ctx.fillStyle = `rgba(250, 250, 250, ${this.life})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
      }
    }

    class Drop {
      x!: number;
      y!: number;
      vx!: number;
      vy!: number;
      baseVx!: number;
      state!: string;
      size!: number;
      oscillationSpeed!: number;
      phase!: number;
      z!: number;
      canCollide!: boolean;

      constructor() {
        this.reset();
        this.y = Math.random() * height;
        this.x = Math.random() * width + height * rainVelocityX;
      }

      reset() {
        this.x = Math.random() * width - height * 0.3 * rainVelocityX;
        this.y = -20;

        const baseSpeed = Math.random() * 15 + 10;
        this.vy = baseSpeed * rainVelocityY;
        this.baseVx = baseSpeed * rainVelocityX;
        this.vx = this.baseVx;

        this.state = 'falling';
        this.size = Math.random() * 1.5 + 1.2;
        this.oscillationSpeed = Math.random() * 0.1 + 0.05;
        this.phase = Math.random() * Math.PI * 2;
        this.z = Math.random();
        this.canCollide = this.z > 0.45 && this.z < 0.55;
      }

      isSolid(tx: number, ty: number) {
        if (ty < 0 || ty >= height || tx < 0 || tx >= width) return false;
        if (ty > height / 2 - 250 && ty < height / 2 + 250) {
          return (
            hitCtx.getImageData(Math.floor(tx), Math.floor(ty), 1, 1).data[0] >
            100
          );
        }
        return false;
      }

      update() {
        const nextY = this.y + this.vy;
        const nextX = this.x + this.vx;

        if (this.canCollide) {
          const isCurrentlyInSolid = this.isSolid(nextX, nextY);
          const wasInSolid = this.isSolid(this.x, this.y);

          if (this.state === 'falling' && isCurrentlyInSolid && !wasInSolid) {
            this.state = 'flowing';
            this.y = nextY;
            this.vy = 0;
            this.vx = 0;

            for (let k = 0; k < 10; k++) {
              splashes.push(new Splash(this.x, this.y, rainAngleRad));
            }
          } else if (this.state === 'flowing') {
            if (isCurrentlyInSolid) {
              if (Math.random() < 0.1) {
                this.vy = 0.1;
              } else {
                if (this.vy < 5) this.vy += 0.3;
              }

              const noise = (Math.random() - 0.5) * 2;
              this.vx =
                Math.sin(this.y * this.oscillationSpeed + this.phase) * 0.5 +
                noise;
              this.y += this.vy;
              this.x += this.vx;
            } else {
              this.state = 'detaching';
              this.vx = this.baseVx * 0.5;
              this.vy = 2;
            }
          } else if (this.state === 'detaching') {
            this.y += this.vy;
            this.x += this.vx;
            this.vy += 0.5;
            this.vx += this.baseVx * 0.05;

            if (this.vy > 12) {
              this.state = 'falling';
              this.vx = this.baseVx;
            }
          } else {
            this.y = nextY;
            this.x = nextX;
            if (this.vy < 25 * rainVelocityY) this.vy += 0.5 * rainVelocityY;
          }
        } else {
          this.y = nextY;
          this.x = nextX;
          if (this.vy < 25 * rainVelocityY) this.vy += 0.5 * rainVelocityY;
        }

        if (this.y > height || this.x > width + 100) this.reset();
      }

      draw() {
        let opacity = this.z * 0.5;
        if (isLightning) opacity = 0.8;

        if (this.state === 'falling') {
          ctx.fillStyle = `rgba(180, 200, 220, ${opacity})`;

          const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
          const len = speed * (this.z + 1.2);
          const angle = Math.atan2(this.vy, this.vx);

          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(angle);
          ctx.fillRect(0, -0.6, len, 1.2);
          ctx.restore();
        } else {
          let stretch = this.vy * 18;
          if (stretch < this.size) stretch = this.size;

          const grad = ctx.createLinearGradient(
            this.x,
            this.y - stretch,
            this.x,
            this.y,
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(this.x - this.size / 2, this.y);
          ctx.lineTo(this.x, this.y - stretch);
          ctx.lineTo(this.x + this.size / 2, this.y);
          ctx.fill();

          ctx.beginPath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.arc(
            this.x - this.size * 0.3,
            this.y - this.size * 0.3,
            this.size * 0.35,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }

    function drawHappyBirthday() {
      if (hbFlicker <= 0.01) return;
      const fontSize = Math.min(Math.floor(width * 0.065), 100);
      ctx.save();
      ctx.globalAlpha = hbFlicker;
      ctx.font = `900 ${fontSize}px Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(160, 210, 255, 1)';
      ctx.shadowBlur = 20 + lightningIntensity * 40;
      ctx.fillStyle = 'rgba(225, 242, 255, 3.95)';
      ctx.fillText('Happy Birthday !!!', width / 2, height * 0.2);
      ctx.restore();
    }

    function drawSunnyOverlay() {
      if (weather <= 0) return;
      const cx = width / 2;
      const cy = height * 0.28;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.7);
      grad.addColorStop(0, `rgba(255, 220, 100, ${weather * 0.4})`);
      grad.addColorStop(0.3, `rgba(255, 170,  50, ${weather * 0.22})`);
      grad.addColorStop(0.65, `rgba(255, 100,  20, ${weather * 0.08})`);
      grad.addColorStop(1, 'rgba(200, 60, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    function init() {
      resize();
      initClouds();
      drops = [];
      for (let i = 0; i < dropCount; i++) {
        drops.push(new Drop());
      }
      animate();
    }

    const animate = () => {
      frameCount++;

      if (!isLightning && Math.random() < 0.006 * (1 - weather)) {
        isLightning = true;
        lightningTimer = Math.random() * 12 + 8;
        lightningIntensity = 1.0;

        lightningBolts.push(new LightningBolt());

        if (Math.random() > 0.6) {
          setTimeout(() => {
            lightningBolts.push(new LightningBolt());
          }, 80);
        }
      }

      if (isLightning) {
        lightningTimer--;
        lightningIntensity = Math.max(0, lightningIntensity - 0.06);

        if (lightningTimer <= 0) {
          isLightning = false;
          lightningIntensity = 0;
        }
      }

      hbFlicker =
        isLightning && lightningIntensity > 0
          ? lightningIntensity * (0.55 + Math.random() * 0.45)
          : Math.max(0, hbFlicker - 0.05);

      if (isLightning && lightningIntensity > 0.5 && Math.random() > 0.7) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningIntensity * 0.04})`;
        ctx.fillRect(0, 0, width, height);
      }

      const bgR = Math.round(weather * 45);
      const bgG = Math.round(weather * 28);
      ctx.fillStyle = `rgba(${bgR}, ${bgG}, 0, ${0.4 - weather * 0.1})`;
      ctx.fillRect(0, 0, width, height);

      cloudLayers.forEach((layer) => {
        layer.update();
        layer.draw();
      });

      for (let i = lightningBolts.length - 1; i >= 0; i--) {
        lightningBolts[i].update();
        lightningBolts[i].draw();
        if (lightningBolts[i].life <= 0) {
          lightningBolts.splice(i, 1);
        }
      }

      draw3DText();

      const activeDropCount = Math.floor(drops.length * (1 - weather));
      for (let i = 0; i < activeDropCount; i++) {
        drops[i].update();
        drops[i].draw();
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
        splashes[i].update();
        splashes[i].draw();
        if (splashes[i].life <= 0) {
          splashes.splice(i, 1);
        }
      }

      drawSunnyOverlay();
      drawHappyBirthday();

      this.rafId = requestAnimationFrame(animate);
    };

    this.setWeatherFn = (w: number) => {
      weather = w;
    };
    this.resizeListener = resize;
    window.addEventListener('resize', this.resizeListener);
    init();

    this.subs.add(
      this.appState.weather$.subscribe((w) => this.setWeatherFn?.(w)),
    );
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resizeListener);
    this.subs.unsubscribe();
  }
}
