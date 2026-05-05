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
    loadComponent: () =>
      import('./features/city-detail/city-detail').then((m) => m.CityDetailPageComponent),
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
    path: '**',
    component: NotFound,
  },
];
