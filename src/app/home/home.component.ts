import { Component } from '@angular/core';
import { NeuralNetworkComponent } from '../components/neural-network/neural-network.component';
import { RainComponent } from '../rain/rain.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RainComponent, NeuralNetworkComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {}
