import { Component, inject } from '@angular/core';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  template: `
    <nav class="navbar">
      <span class="navbar__title">{{ title }}</span>
      <div class="navbar__controls">
        <button
          class="navbar__rain-btn"
          [class.navbar__rain-btn--on]="rainState === 'active'"
          (click)="toggleRain()"
        >{{ rainState === 'active' ? '● ON' : '● OFF' }}</button>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);
    }

    .navbar__title {
      font-family: 'Roboto', sans-serif;
      font-weight: 900;
      font-size: 0.85rem;
      letter-spacing: 0.25em;
      color: rgba(180, 200, 220, 0.7);
    }

    .navbar__controls {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .navbar__rain-btn {
      border-radius: 6px;
      padding: 4px 14px;
      font-family: 'Roboto', sans-serif;
      font-weight: 900;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: background 0.25s, border-color 0.25s, color 0.25s;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.55);
      color: rgba(239, 100, 100, 0.9);
    }

    .navbar__rain-btn--on {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.55);
      color: rgba(60, 210, 110, 0.9);
    }

    .navbar__rain-btn:hover { filter: brightness(1.25); }
  `],
})
export class NavbarComponent {
  protected readonly appState = inject(AppStateService);

  readonly title = '';
  rainState: 'active' | 'paused' | 'removed' = 'active';

  toggleRain(): void {
    this.rainState = this.rainState === 'active' ? 'paused' : 'active';
    this.appState.setRain(this.rainState);
  }
}
