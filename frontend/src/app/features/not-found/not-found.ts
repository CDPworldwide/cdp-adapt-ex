import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [MatCardModule, RouterLink],
  templateUrl: './not-found.html',
  styleUrls: ['../shared-feature-styles.css', './not-found.css'],
})
export class NotFound {}
