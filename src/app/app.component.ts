import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BannerComponent } from './banner/banner.component';
import { NeuralNetworkComponent } from "./components/neural-network/neural-network.component";
import { NavbarComponent } from './navbar/navbar.component';
import { SkateComponent } from './skate/skate.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, SkateComponent, BannerComponent, NeuralNetworkComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {


}
