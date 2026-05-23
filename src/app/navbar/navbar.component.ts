import { Component, inject } from '@angular/core';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  template: `
    <nav class="navbar">
      <span class="navbar__title">{{ title }}</span>
      <div class="navbar__controls">
        <input
          class="navbar__text-input"
          type="text"
          [value]="displayText"
          (input)="onTextInput($event)"
          maxlength="10"
          placeholder="RAIN"
          spellcheck="false"
        >
        <button class="navbar__skate-btn" (click)="appState.triggerSkate()">SK8</button>
        <select
          class="navbar__select"
          [value]="rainState"
          (change)="onRainStateChange($event)"
        >
          <option value="active">Active</option>
          <option value="paused">Pause</option>
          <option value="removed">Remove</option>
        </select>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
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

    .navbar__text-input {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(180, 200, 220, 0.25);
      border-radius: 6px;
      padding: 4px 10px;
      color: rgba(180, 200, 220, 0.85);
      font-family: 'Roboto', sans-serif;
      font-weight: 900;
      font-size: 0.85rem;
      letter-spacing: 0.2em;
      width: 120px;
      outline: none;
      text-transform: uppercase;
    }

    .navbar__text-input::placeholder {
      color: rgba(180, 200, 220, 0.3);
    }

    .navbar__text-input:focus {
      border-color: rgba(180, 200, 220, 0.5);
      background: rgba(255, 255, 255, 0.1);
    }

    .navbar__skate-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(180, 200, 220, 0.25);
      border-radius: 6px;
      padding: 4px 10px;
      color: rgba(180, 200, 220, 0.85);
      font-family: 'Roboto', sans-serif;
      font-weight: 900;
      font-size: 0.8rem;
      letter-spacing: 0.15em;
      cursor: pointer;
    }

    .navbar__skate-btn:hover {
      border-color: rgba(180, 200, 220, 0.5);
      background: rgba(255, 255, 255, 0.1);
    }

    .navbar__skate-btn:active {
      background: rgba(255, 255, 255, 0.15);
    }

    .navbar__select {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(180, 200, 220, 0.25);
      border-radius: 6px;
      padding: 4px 8px;
      color: rgba(180, 200, 220, 0.85);
      font-family: 'Roboto', sans-serif;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      outline: none;
      cursor: pointer;
      appearance: none;
      padding-right: 24px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(180,200,220,0.5)'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
    }

    .navbar__select option {
      background: #0a0a0f;
      color: rgba(180, 200, 220, 0.85);
    }

    .navbar__select:focus {
      border-color: rgba(180, 200, 220, 0.5);
    }
  `],
})
export class NavbarComponent {
  protected readonly appState = inject(AppStateService);

  readonly title = 'Happy Birthday';
  displayText = 'Atticus';
  rainState: 'active' | 'paused' | 'removed' = 'active';

  onTextInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.displayText = value;
    this.appState.setText(value);
  }

  onRainStateChange(event: Event): void {
    const state = (event.target as HTMLSelectElement).value as typeof this.rainState;
    this.rainState = state;
    this.appState.setRain(state);
  }
}
