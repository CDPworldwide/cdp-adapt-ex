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
    path: 'org/:organizationSlug',
    redirectTo: 'org/:organizationSlug/hazards',
    pathMatch: 'full',
  },
  {
    path: 'org/:organizationSlug/chat',
    loadComponent: () =>
      import('./features/city-detail/city-detail').then((m) => m.CityDetailPageComponent),
    data: {
      openAiPanel: true,
    },
  },
  {
    path: 'org/:organizationSlug/:tab',
    loadComponent: () =>
      import('./features/city-detail/city-detail').then((m) => m.CityDetailPageComponent),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./features/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
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
