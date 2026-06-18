import { Routes } from '@angular/router';
import { NotFound } from './features/not-found/not-found';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/main-search/main-search').then((m) => m.MainSearchComponent),
    data: {
      name: 'Main',
    },
  },
  {
    path: 'org/:organizationId',
    redirectTo: 'org/:organizationId/hazards',
    pathMatch: 'full',
  },
  {
    path: 'org/:organizationId/chat',
    loadComponent: () =>
      import('./features/city-detail/city-detail').then((m) => m.CityDetailPageComponent),
    data: {
      openAiPanel: true,
    },
  },
  {
    path: 'org/:organizationId/:tab',
    loadComponent: () =>
      import('./features/city-detail/city-detail').then((m) => m.CityDetailPageComponent),
  },
  {
    path: 'methodology',
    loadComponent: () =>
      import('./features/methodology/methodology').then((m) => m.MethodologyComponent),
  },
  {
    path: 'learn-more',
    loadComponent: () =>
      import('./features/learn-more/learn-more').then((m) => m.LearnMoreComponent),
  },
  {
    path: 'solutions',
    redirectTo: 'solutions/climate-risk-data-for-banks',
    pathMatch: 'full',
  },
  {
    path: 'solutions/climate-risk-data-for-banks',
    loadComponent: () =>
      import('./features/commercial-landing/commercial-landing').then(
        (m) => m.CommercialLandingComponent,
      ),
    data: {
      commercialLandingKey: 'climateRiskDataForBanks',
    },
  },
  {
    path: 'solutions/city-climate-risk-intelligence',
    loadComponent: () =>
      import('./features/commercial-landing/commercial-landing').then(
        (m) => m.CommercialLandingComponent,
      ),
    data: {
      commercialLandingKey: 'cityClimateRiskIntelligence',
    },
  },
  {
    path: 'solutions/adaptation-project-pipeline',
    loadComponent: () =>
      import('./features/commercial-landing/commercial-landing').then(
        (m) => m.CommercialLandingComponent,
      ),
    data: {
      commercialLandingKey: 'adaptationProjectPipeline',
    },
  },
  {
    path: 'industries',
    redirectTo: 'industries/insurance',
    pathMatch: 'full',
  },
  {
    path: 'industries/insurance',
    loadComponent: () =>
      import('./features/commercial-landing/commercial-landing').then(
        (m) => m.CommercialLandingComponent,
      ),
    data: {
      commercialLandingKey: 'insurance',
    },
  },
  {
    path: 'industries/infrastructure-investors',
    loadComponent: () =>
      import('./features/commercial-landing/commercial-landing').then(
        (m) => m.CommercialLandingComponent,
      ),
    data: {
      commercialLandingKey: 'infrastructureInvestors',
    },
  },
  {
    path: 'industries/climate-consultants',
    loadComponent: () =>
      import('./features/commercial-landing/commercial-landing').then(
        (m) => m.CommercialLandingComponent,
      ),
    data: {
      commercialLandingKey: 'climateConsultants',
    },
  },
  {
    path: '**',
    component: NotFound,
  },
];
