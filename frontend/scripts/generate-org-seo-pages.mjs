import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('dist/frontend/browser');
const INDEX_HTML_PATH = path.join(OUTPUT_DIR, 'index.html');
const ENVIRONMENT_PATH = path.resolve('src/environments/environment.ts');
const SITE_URL = stripTrailingSlash(process.env.SEO_SITE_URL || 'https://cdp-action-explorer.net');
const SITEMAP_URL_LIMIT = 45_000;
const INDEXABLE_TABS = ['hazards', 'actions', 'solutions'];

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function normalizeSpace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeSpace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildOrganizationSlugSegment(location) {
  const textSlug = slugify([location.name, location.country].filter(Boolean).join(' '));
  return textSlug ? `${location.id}-${textSlug}` : String(location.id);
}

function getTabsForLocation(location) {
  return INDEXABLE_TABS.filter(
    (tab) => tab !== 'actions' || location.publicStatus !== 'GEE-Derived',
  );
}

function titleFor(location, tab) {
  const place = [location.name, location.country].filter(Boolean).join(', ');
  if (tab === 'actions') {
    return `${place} adaptation actions and resilience projects | CDP`;
  }
  if (tab === 'solutions') {
    return `Climate adaptation solutions for ${place} | CDP`;
  }
  return `${place} climate hazards and adaptation actions | CDP`;
}

function descriptionFor(location, tab) {
  const place = [location.name, location.country].filter(Boolean).join(', ');
  const hazards = (location.topHazards ?? []).slice(0, 3).join(', ');
  const hazardText = hazards ? ` Top climate hazards include ${hazards}.` : '';
  const yearText = location.disclosureYear ? ` ${location.disclosureYear} data.` : '';

  if (tab === 'actions') {
    return normalizeSpace(
      `Explore adaptation actions, goals, and projects seeking funding for ${place} in the CDP Adaptation and Action Explorer.${hazardText}${yearText}`,
    );
  }

  if (tab === 'solutions') {
    return normalizeSpace(
      `Explore peer climate adaptation solutions for ${place}, including approaches related to local hazards and resilience planning.${hazardText}${yearText}`,
    );
  }

  return normalizeSpace(
    `Explore climate hazards, adaptation actions, and funding-ready resilience projects for ${place} in the CDP Adaptation and Action Explorer.${hazardText}${yearText}`,
  );
}

function tabLabel(tab) {
  if (tab === 'actions') return 'Adaptation actions';
  if (tab === 'solutions') return 'Peer solutions';
  return 'Climate hazards';
}

function buildStaticFallback(location, slug, tab) {
  const tabs = getTabsForLocation(location);
  const topHazards = (location.topHazards ?? []).slice(0, 5);
  const counts = [
    ['Adaptation actions', location.actionCount],
    ['Adaptation goals', location.goalCount],
    ['Projects seeking funding', location.projectCount],
    ['Peer solution ideas', location.solutionCount],
  ].filter(([, count]) => Number(count) > 0);

  return `
    <main id="pseo-summary">
      <h1>${escapeHtml(titleFor(location, tab).replace(' | CDP', ''))}</h1>
      <p>${escapeHtml(descriptionFor(location, tab))}</p>
      <nav aria-label="Organization sections">
        ${tabs
          .map(
            (tabName) => `<a href="/org/${slug}/${tabName}">${escapeHtml(tabLabel(tabName))}</a>`,
          )
          .join(' ')}
      </nav>
      ${
        topHazards.length
          ? `<section><h2>Top climate hazards</h2><ul>${topHazards
              .map((hazard) => `<li>${escapeHtml(hazard)}</li>`)
              .join('')}</ul></section>`
          : ''
      }
      ${
        counts.length
          ? `<section><h2>Adaptation data</h2><dl>${counts
              .map(
                ([label, count]) =>
                  `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(count))}</dd>`,
              )
              .join('')}</dl></section>`
          : ''
      }
    </main>`;
}

function buildJsonLd(location, canonicalUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': location.organizationType === 'States & Regions' ? 'AdministrativeArea' : 'Place',
    name: location.name,
    url: canonicalUrl,
    identifier: String(location.id),
  };

  if (location.country) {
    data.address = {
      '@type': 'PostalAddress',
      addressCountry: location.country,
    };
  }

  if (location.population) {
    data.additionalProperty = [
      {
        '@type': 'PropertyValue',
        name: 'Population',
        value: location.population,
      },
    ];
  }

  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function replaceOrInsertHead(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function buildPageHtml(baseHtml, location, slug, tab) {
  const canonicalUrl = `${SITE_URL}/org/${slug}/${tab}`;
  const title = titleFor(location, tab);
  const description = descriptionFor(location, tab);
  const fallback = buildStaticFallback(location, slug, tab);

  let html = baseHtml
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace('<app-root></app-root>', `<app-root>${fallback}</app-root>`);

  html = replaceOrInsertHead(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  );

  return html.replace(
    '</head>',
    `  <script type="application/ld+json" data-generated="org-seo">${buildJsonLd(
      location,
      canonicalUrl,
    )}</script>\n  </head>`,
  );
}

async function readEnvironmentField(name) {
  try {
    const text = await readFile(ENVIRONMENT_PATH, 'utf8');
    const match = text.match(new RegExp(`${name}: '([^']*)'`));
    return match?.[1] ?? '';
  } catch {
    return '';
  }
}

async function fetchSeoSummaries() {
  const baseUrl = process.env.FRONTEND_BASE_URL || (await readEnvironmentField('baseUrl'));
  const apiKey = process.env.FRONTEND_API_KEY || (await readEnvironmentField('apiKey'));
  const apiKeyHeaderName =
    process.env.FRONTEND_API_KEY_HEADER_NAME ||
    (await readEnvironmentField('apiKeyHeaderName')) ||
    'X-API-Key';

  if (!baseUrl || !apiKey) {
    throw new Error(
      'Missing FRONTEND_BASE_URL or FRONTEND_API_KEY. Set SEO_SKIP=true to skip SEO artifact generation.',
    );
  }

  const response = await fetch(new URL('/api/v1/locations/seo', baseUrl), {
    headers: {
      [apiKeyHeaderName]: apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SEO summaries: HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload.locations ?? [];
}

function sitemapXml(urls, lastmod) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

function sitemapIndexXml(sitemaps, lastmod) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (url) => `  <sitemap>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>
`;
}

async function writeSitemap(urls) {
  const lastmod = new Date().toISOString().slice(0, 10);
  if (urls.length <= SITEMAP_URL_LIMIT) {
    await writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemapXml(urls, lastmod));
    return;
  }

  const sitemapsDir = path.join(OUTPUT_DIR, 'sitemaps');
  await mkdir(sitemapsDir, { recursive: true });
  const sitemapUrls = [];

  for (let index = 0; index * SITEMAP_URL_LIMIT < urls.length; index += 1) {
    const chunk = urls.slice(index * SITEMAP_URL_LIMIT, (index + 1) * SITEMAP_URL_LIMIT);
    const filename = `org-${index + 1}.xml`;
    await writeFile(path.join(sitemapsDir, filename), sitemapXml(chunk, lastmod));
    sitemapUrls.push(`${SITE_URL}/sitemaps/${filename}`);
  }

  await writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemapIndexXml(sitemapUrls, lastmod));
}

async function main() {
  if (process.env.SEO_SKIP === 'true') {
    console.log('Skipping SEO artifact generation because SEO_SKIP=true.');
    return;
  }

  const baseHtml = await readFile(INDEX_HTML_PATH, 'utf8');
  const locations = await fetchSeoSummaries();
  const orgDir = path.join(OUTPUT_DIR, 'org');
  const canonicalUrls = [`${SITE_URL}/`, `${SITE_URL}/methodology`, `${SITE_URL}/learn-more`];

  await rm(orgDir, { recursive: true, force: true });

  for (const location of locations) {
    if (!location.id || !location.name) {
      continue;
    }

    const slug = buildOrganizationSlugSegment(location);
    const tabs = getTabsForLocation(location);

    await mkdir(path.join(orgDir, slug), { recursive: true });
    await writeFile(
      path.join(orgDir, slug, 'index.html'),
      buildPageHtml(baseHtml, location, slug, 'hazards'),
    );

    for (const tab of tabs) {
      const pageDir = path.join(orgDir, slug, tab);
      await mkdir(pageDir, { recursive: true });
      await writeFile(
        path.join(pageDir, 'index.html'),
        buildPageHtml(baseHtml, location, slug, tab),
      );
      canonicalUrls.push(`${SITE_URL}/org/${slug}/${tab}`);
    }
  }

  await writeSitemap(canonicalUrls);

  console.log(
    `Generated ${canonicalUrls.length} sitemap URLs and static SEO pages for ${locations.length} organizations.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
