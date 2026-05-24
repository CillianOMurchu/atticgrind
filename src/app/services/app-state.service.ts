import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private _text              = new BehaviorSubject<string>('Atticus');
  private _weather           = new BehaviorSubject<number>(0.9);
  private _footballerTrigger = new Subject<void>();

  readonly text$              = this._text.asObservable();
  readonly weather$           = this._weather.asObservable();
  readonly footballerTrigger$ = this._footballerTrigger.asObservable();

  setText(v: string): void      { this._text.next(v); }
  setWeather(v: number): void   { this._weather.next(Math.max(0, Math.min(1, v))); }
  triggerFootballer(): void     { this._footballerTrigger.next(); }
}
