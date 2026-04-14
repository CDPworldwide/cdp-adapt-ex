import { Component } from '@angular/core';
import { CdpLogoWithTextIconComponent } from '../../shared/icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  imports: [CdpLogoWithTextIconComponent, TranslateModule],
  templateUrl: './footer.html',
  standalone: true,
})
export class Footer {}
