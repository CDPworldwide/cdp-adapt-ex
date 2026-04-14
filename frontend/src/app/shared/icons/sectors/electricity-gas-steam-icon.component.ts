import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-electricity-gas-steam-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './electricity-gas-steam-icon.component.html',
})
export class ElectricityGasSteamIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
