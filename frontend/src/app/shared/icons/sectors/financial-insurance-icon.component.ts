import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-financial-insurance-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-insurance-icon.component.html',
})
export class FinancialInsuranceIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
