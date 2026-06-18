import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Footer } from '../../core/footer/footer';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import commercialLandingPagesData from './commercial-landing-pages.json';

interface CommercialLandingCta {
  label: string;
  href: string;
  external?: boolean;
}

interface CommercialLandingMetric {
  label: string;
  value: string;
}

interface CommercialLandingSection {
  heading: string;
  body: string;
  items: string[];
}

interface CommercialLandingWorkflowStep {
  title: string;
  body: string;
}

export interface CommercialLandingPage {
  key: string;
  path: string;
  eyebrow: string;
  audience: string;
  title: string;
  summary: string;
  metaTitle: string;
  metaDescription: string;
  heroImage: string;
  primaryCta: CommercialLandingCta;
  secondaryCta: CommercialLandingCta;
  metrics: CommercialLandingMetric[];
  commercialQuestions: string[];
  sections: CommercialLandingSection[];
  workflow: CommercialLandingWorkflowStep[];
  relatedPageKeys: string[];
}

const PAGES = commercialLandingPagesData.pages as CommercialLandingPage[];
const PAGES_BY_KEY = new Map(PAGES.map((page) => [page.key, page]));
const DEFAULT_PAGE = PAGES[0] as CommercialLandingPage;
const SITE_URL = 'https://cdp-action-explorer.net';

@Component({
  selector: 'app-commercial-landing',
  standalone: true,
  imports: [RouterLink, AppHeaderComponent, Footer],
  templateUrl: './commercial-landing.html',
  styleUrls: ['./commercial-landing.css'],
})
export class CommercialLandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  readonly page = signal<CommercialLandingPage>(DEFAULT_PAGE);
  readonly relatedPages = computed(() =>
    this.page()
      .relatedPageKeys.map((key) => PAGES_BY_KEY.get(key))
      .filter((page): page is CommercialLandingPage => Boolean(page)),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.data.pipe(takeUntilDestroyed(destroyRef)).subscribe((data) => {
      const pageKey = data['commercialLandingKey'];
      const page = typeof pageKey === 'string' ? PAGES_BY_KEY.get(pageKey) : undefined;
      this.setPage(page ?? DEFAULT_PAGE);
    });
  }

  isExternalLink(cta: CommercialLandingCta): boolean {
    return cta.external === true || /^https?:\/\//.test(cta.href);
  }

  private setPage(page: CommercialLandingPage): void {
    this.page.set(page);
    this.updatePageMetadata(page);
  }

  private updatePageMetadata(page: CommercialLandingPage): void {
    const canonicalUrl = `${SITE_URL}${page.path}`;

    this.title.setTitle(page.metaTitle);
    this.meta.updateTag({ name: 'description', content: page.metaDescription });
    this.meta.updateTag({ property: 'og:title', content: page.metaTitle });
    this.meta.updateTag({ property: 'og:description', content: page.metaDescription });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ name: 'twitter:title', content: page.metaTitle });
    this.meta.updateTag({ name: 'twitter:description', content: page.metaDescription });
    this.setCanonicalUrl(canonicalUrl);
  }

  private setCanonicalUrl(canonicalUrl: string): void {
    let canonicalLink = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = this.document.createElement('link');
      canonicalLink.rel = 'canonical';
      this.document.head.appendChild(canonicalLink);
    }

    canonicalLink.href = canonicalUrl;
  }
}
