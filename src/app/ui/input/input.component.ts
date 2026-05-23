import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-input',
  standalone: true,
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss']
})
export class InputComponent {
  @Input() placeholder = '';
  @Input() value = '';
  @Input() type: 'text' | 'email' | 'password' = 'text';
}
