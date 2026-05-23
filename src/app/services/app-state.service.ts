import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private _text    = new BehaviorSubject<string>('Atticus');
  private _weather = new BehaviorSubject<number>(0.9); // 0 = full storm, 1 = sunny

  readonly text$    = this._text.asObservable();
  readonly weather$ = this._weather.asObservable();

  setText(v: string): void    { this._text.next(v); }
  setWeather(v: number): void { this._weather.next(Math.max(0, Math.min(1, v))); }
}
