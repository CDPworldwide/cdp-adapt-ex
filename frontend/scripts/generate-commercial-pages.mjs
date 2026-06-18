import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('dist/frontend/browser');
const INDEX_HTML_PATH = path.join(OUTPUT_DIR, 'index.html');
const PAGES_PATH = path.resolve(
  'src/app/features/commercial-landing/commercial-landing-pages.json',
);
const SITE_URL = stripTrailingSlash(
  process.env.COMMERCIAL_SITE_URL || 'https://cdp-action-explorer.net',
);

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

function replaceOrInsertHead(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function canonicalUrlFor(page) {
  return `${SITE_URL}${page.path}`;
}

function renderCta(cta) {
  const href = cta.external ? cta.href : `${SITE_URL}${cta.href}`;
  return `<a href="${escapeHtml(href)}">${escapeHtml(cta.label)}</a>`;
}

function renderStaticFallback(page) {
  return `
    <main id="commercial-summary">
      <header>
        <p>${escapeHtml(page.eyebrow)}</p>
        <h1>${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.summary)}</p>
        <nav aria-label="Commercial page actions">
          ${renderCta(page.primaryCta)}
          ${renderCta(page.secondaryCta)}
        </nav>
      </header>
      <section aria-label="Commercial fit">
        <h2>Built for ${escapeHtml(page.audience)}</h2>
        <dl>
          ${page.metrics
            .map(
              (metric) =>
                `<dt>${escapeHtml(metric.label)}</dt><dd>${escapeHtml(metric.value)}</dd>`,
            )
            .join('')}
        </dl>
      </section>
      <section>
        <h2>Commercial questions this helps answer</h2>
        <ul>
          ${page.commercialQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}
        </ul>
      </section>
      ${page.sections
        .map(
          (section) => `
            <section>
              <h2>${escapeHtml(section.heading)}</h2>
              <p>${escapeHtml(section.body)}</p>
              <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </section>
          `,
        )
        .join('')}
    </main>`;
}

function renderJsonLd(page) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: canonicalUrlFor(page),
    description: page.metaDescription,
    audience: {
      '@type': 'Audience',
      audienceType: page.audience,
    },
    publisher: {
      '@type': 'Organization',
      name: 'CDP',
      url: 'https://www.cdp.net/',
    },
  };

  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildPageHtml(baseHtml, page) {
  const canonicalUrl = canonicalUrlFor(page);
  let html = baseHtml
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.metaTitle)}</title>`)
    .replace('<app-root></app-root>', `<app-root>${renderStaticFallback(page)}</app-root>`);

  html = replaceOrInsertHead(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(page.metaDescription)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeHtml(page.metaTitle)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeHtml(page.metaDescription)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(page.metaTitle)}" />`,
  );
  html = replaceOrInsertHead(
    html,
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(page.metaDescription)}" />`,
  );

  return html.replace(
    '</head>',
    `  <script type="application/ld+json" data-generated="commercial-page">${renderJsonLd(
      page,
    )}</script>\n  </head>`,
  );
}

function sitemapXml(urls) {
  const lastmod = new Date().toISOString().slice(0, 10);
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

async function main() {
  const baseHtml = await readFile(INDEX_HTML_PATH, 'utf8');
  const pageData = JSON.parse(await readFile(PAGES_PATH, 'utf8'));
  const pages = pageData.pages ?? [];
  const sitemapUrls = [`${SITE_URL}/`, `${SITE_URL}/methodology`, `${SITE_URL}/learn-more`];

  for (const page of pages) {
    const pageDir = path.join(OUTPUT_DIR, page.path);
    await mkdir(pageDir, { recursive: true });
    await writeFile(path.join(pageDir, 'index.html'), buildPageHtml(baseHtml, page));
    sitemapUrls.push(canonicalUrlFor(page));
  }

  await writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemapXml(sitemapUrls));
  console.log(`Generated ${pages.length} commercial landing pages and sitemap.xml.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
