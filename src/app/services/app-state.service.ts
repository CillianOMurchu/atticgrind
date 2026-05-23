import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private _text = new BehaviorSubject<string>('Atticus');
  private _rain = new BehaviorSubject<'active' | 'paused' | 'removed'>('active');
  private _skate = new Subject<void>();

  readonly text$ = this._text.asObservable();
  readonly rain$ = this._rain.asObservable();
  readonly skate$ = this._skate.asObservable();

  get rainValue(): 'active' | 'paused' | 'removed' {
    return this._rain.value;
  }

  setText(v: string): void { this._text.next(v); }
  setRain(v: 'active' | 'paused' | 'removed'): void { this._rain.next(v); }
  triggerSkate(): void { this._skate.next(); }
}
