import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import { ExportTrackingService } from '../../core/analytics/export-tracking.service';

interface HazardLayer {
  id: string;
}

interface MinimumCriterion {
  id: string;
  questionNumber: string;
  rawDataLinks?: { labelKey: string; url: string }[];
}

@Component({
  selector: 'app-methodology',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppHeaderComponent],
  templateUrl: './methodology.html',
  styleUrls: ['./methodology.css'],
})
export class MethodologyComponent {
  readonly hazardLayers: HazardLayer[] = [
    { id: 'waterStress' },
    { id: 'flooding' },
    { id: 'fireWeather' },
    { id: 'extremeHeat' },
    { id: 'extremeCold' },
    { id: 'extremePrecipitation' },
    { id: 'soilDegradation' },
  ];

  readonly minimumCriteria: MinimumCriterion[] = [
    {
      id: 'climateHazards',
      questionNumber: '2.2',
      rawDataLinks: [
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.cities',
          url: 'https://data.cdp.net/Full-cities-public-datasets/2025-Full-Cities-Public-Data-Separated-by-Question/fjfh-2t9d/about_data',
        },
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.statesAndRegions',
          url: 'https://data.cdp.net/Full-states-and-regions-public-datasets/2025-Full-States-and-Regions-Public-Data-Separated/s3cp-8s8w/about_data',
        },
      ],
    },
    {
      id: 'adaptationGoals',
      questionNumber: '5.1.1',
      rawDataLinks: [
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.cities',
          url: 'https://data.cdp.net/Full-cities-public-datasets/2025-Full-Cities-Public-Data-Separated-by-Question/fjfh-2t9d/about_data',
        },
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.statesAndRegions',
          url: 'https://data.cdp.net/Full-states-and-regions-public-datasets/2025-Full-States-and-Regions-Public-Data-Separated/s3cp-8s8w/about_data',
        },
      ],
    },
    {
      id: 'adaptationActions',
      questionNumber: '9.1',
      rawDataLinks: [
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.cities',
          url: 'https://data.cdp.net/Full-cities-public-datasets/2025-Full-Cities-Public-Data-Separated-by-Question/fjfh-2t9d/about_data',
        },
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.statesAndRegions',
          url: 'https://data.cdp.net/Full-states-and-regions-public-datasets/2025-Full-States-and-Regions-Public-Data-Separated/s3cp-8s8w/about_data',
        },
      ],
    },
    {
      id: 'projects',
      questionNumber: '9.3',
      rawDataLinks: [
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.cities',
          url: 'https://data.cdp.net/Climate-projects/2025-Full-Cities-Climate-Projects/tx9p-239w/about_data',
        },
        {
          labelKey: 'methodology.minimumCriteria.rawDataLabels.statesAndRegions',
          url: 'https://data.cdp.net/Climate-projects/2025-Full-States-and-Regions-Projects/wv9g-afef/about_data',
        },
      ],
    },
  ];

  private readonly openAccordions = signal<Set<string>>(new Set());

  constructor(private exportTracking: ExportTrackingService) {}

  isOpen(id: string): boolean {
    return this.openAccordions().has(id);
  }

  toggle(id: string): void {
    this.openAccordions.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  trackRawDatasetExport(row: MinimumCriterion, url: string): void {
    this.exportTracking.trackExternalExport({
      destination_url: url,
      export_type: 'raw_dataset',
      methodology_topic: row.id,
      question_number: row.questionNumber,
      source: 'methodology_raw_data_link',
    });
  }
}
