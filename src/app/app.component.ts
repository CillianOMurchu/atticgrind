import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { SkateComponent } from './skate/skate.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, SkateComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'atticgrind';
}
