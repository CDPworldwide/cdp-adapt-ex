import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdpLogoWithTextIconComponent } from '../../shared/icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  imports: [CdpLogoWithTextIconComponent, TranslateModule, RouterLink],
  templateUrl: './footer.html',
  standalone: true,
})
export class Footer {}
