import { Component } from '@angular/core';
import { RainComponent } from '../rain/rain.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RainComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {}
