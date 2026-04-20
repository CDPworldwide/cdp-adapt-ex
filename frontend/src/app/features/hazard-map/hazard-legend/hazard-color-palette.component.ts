import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hazard-color-palette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hazard-color-palette.component.html',
})
export class HazardColorPaletteComponent implements OnChanges {
  @Input() palette: string[] = [];
  gradient: string | null = null;
  labels: number[] = [];

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['palette'] && this.palette.length > 0) {
      this.gradient = this.createGradient(this.palette);
      this.labels = Array.from({ length: this.palette.length }, (_, i) => i);
    }
  }

  private createGradient(palette: string[]): string {
    return `linear-gradient(to right, ${palette.join(', ')})`;
  }
}
