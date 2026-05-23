import { Component, inject } from '@angular/core';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  template: `
    <nav class="navbar">
      <span class="navbar__title">{{ title }}</span>
      <div class="navbar__controls">
        <span class="navbar__slider-label">🌧</span>
        <input
          class="navbar__weather-slider"
          type="range"
          min="0" max="100" step="1"
          [value]="weatherValue"
          (input)="onWeatherChange($event)"
        >
        <span class="navbar__slider-label">☀</span>
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
      gap: 10px;
    }

    .navbar__slider-label {
      font-size: 1rem;
      line-height: 1;
      opacity: 0.75;
    }

    .navbar__weather-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 140px;
      height: 4px;
      border-radius: 2px;
      background: rgba(180, 200, 220, 0.2);
      outline: none;
      cursor: pointer;
    }

    .navbar__weather-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: rgba(180, 200, 220, 0.85);
      cursor: pointer;
    }

    .navbar__weather-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: rgba(180, 200, 220, 0.85);
      border: none;
      cursor: pointer;
    }
  `],
})
export class NavbarComponent {
  private readonly appState = inject(AppStateService);

  readonly title = '';
  weatherValue = 0;

  onWeatherChange(event: Event): void {
    this.weatherValue = +(event.target as HTMLInputElement).value;
    this.appState.setWeather(this.weatherValue / 100);
  }
}
