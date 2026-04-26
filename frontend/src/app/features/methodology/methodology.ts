import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppHeaderComponent } from '../../shared/app-header/app-header';

interface HazardLayer {
  id: string;
  title: string;
  description: string;
}

interface MinimumCriterion {
  topic: string;
  questionNumber: string;
  rawDataLinks?: { label: string; url: string }[];
  criteria: string;
}

@Component({
  selector: 'app-methodology',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppHeaderComponent],
  templateUrl: './methodology.html',
  styleUrls: ['./methodology.css'],
})
export class MethodologyComponent {
  readonly lastUpdated = 'April 2026';

  readonly hazardLayers: HazardLayer[] = [
    {
      id: 'water-stress',
      title: 'Water stress',
      description:
        'Global water risk data was sourced from the World Resources Institute (WRI) Aqueduct Water Risk Atlas 4.0 framework and aggregated to the HydroBASINS Level 6 unit. The values are provided from WRI in the scale of 0–5.',
    },
    {
      id: 'flooding',
      title: 'Fluvial (riverine) and coastal flooding',
      description:
        'Fluvial and coastal flood depth was sourced from the World Resources Institute Aqueduct Flood Hazard Map dataset. Data is provided at a 1-km resolution for 100-year (i.e. 1 in 100 probability of occurring in a given year) floods.',
    },
    {
      id: 'fire-weather',
      title: 'Fire weather',
      description:
        "This draws from NASA's Fire Weather Index (FWI) dataset, which is based on NEX-GDDP-CMIP6 projections. FWI represents the relationship between weather conditions and elevated fire risk. The number of days per year in which the FWI exceeds a threshold of 45 is used, representing days with high fire danger.",
    },
    {
      id: 'extreme-heat',
      title: 'Extreme heat / heat stress',
      description:
        'This is calculated as the number of days on which the near surface air temperature (the temperature felt at 2 meters above the ground) exceeds 35 °C, representing extreme heat-day frequency.',
    },
    {
      id: 'extreme-cold',
      title: 'Extreme cold',
      description:
        'This is calculated as the number of days on which the minimum near surface air temperature (the temperature felt at 2 meters above the ground) falls below 0 °C, representing extreme cold-day frequency.',
    },
    {
      id: 'extreme-precipitation',
      title: 'Extreme precipitation',
      description:
        'This is calculated as the maximum 5-day precipitation total in a given year, representing extreme precipitation events.',
    },
    {
      id: 'soil-degradation',
      title: 'Soil degradation / erosion',
      description:
        "To represent one aspect of soil erosion, global landslide hazard maps were accessed from the World Bank's Global Landslide Hazard Map. This is available at 1-km resolution.",
    },
  ];

  readonly minimumCriteria: MinimumCriterion[] = [
    {
      topic: 'Risk and vulnerability assessments',
      questionNumber: '2.1.1',
      rawDataLinks: [
        {
          label: 'Cities',
          url: 'https://data.cdp.net/Full-cities-public-datasets/2025-Full-Cities-Public-Data-Separated-by-Question/fjfh-2t9d/about_data',
        },
        {
          label: 'States and regions',
          url: 'https://data.cdp.net/Full-states-and-regions-public-datasets/2025-Full-States-and-Regions-Public-Data-Separated/s3cp-8s8w/about_data',
        },
      ],
      criteria:
        'The assessment report includes information on the boundary, the year of publication or approval, the factors considered in the assessment, and a link or attachment to the assessment.',
    },
    {
      topic: 'Climate hazards',
      questionNumber: '2.2',
      criteria:
        'The climate hazard reported includes information on the type of hazard, the sectors most exposed by the hazard, and a description of the impacts on vulnerable populations and sectors.',
    },
    {
      topic: 'Adaptation goals',
      questionNumber: '5.1.1',
      criteria:
        'The adaptation goal has a title or description, a base year, and a target year greater than or equal to the reporting year (2025).',
    },
    {
      topic: 'Adaptation actions',
      questionNumber: '9.1',
      criteria:
        'The action reported includes information on the type and category of action, the climate hazards that the action addresses, a description of the action, and the sectors the action applies to.',
    },
    {
      topic: 'Projects',
      questionNumber: '9.3',
      rawDataLinks: [
        {
          label: 'Cities',
          url: 'https://data.cdp.net/Climate-projects/2025-Full-Cities-Climate-Projects/tx9p-239w/about_data',
        },
        {
          label: 'States and regions',
          url: 'https://data.cdp.net/Climate-projects/2025-Full-States-and-Regions-Projects/wv9g-afef/about_data',
        },
      ],
      criteria:
        'The project reported includes information on the project area and at least one more datapoint: project title, project stage, financing status, financing model, project description, total cost, or investment needed.',
    },
  ];

  private readonly openAccordions = signal<Set<string>>(new Set());

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
}
