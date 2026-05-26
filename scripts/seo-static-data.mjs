export const DEFAULT_SITE_URL = 'https://www.navigatewealth.co';
export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
export const DEFAULT_OG_IMAGE_PATH = '/brand-assets/navigate-wealth-social.png';
export const DEFAULT_LANGUAGE = 'en-ZA';
export const DEFAULT_BUSINESS_NAME = 'Navigate Wealth';
export const DEFAULT_BUSINESS_PHONE = '+27126672505';
export const DEFAULT_BUSINESS_EMAIL = 'info@navigatewealth.co';

export const disallowPaths = [
  '/admin',
  '/dashboard',
  '/dashboard/',
  '/products-services-dashboard',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/',
  '/account-type',
  '/get-started',
  '/application',
  '/application/',
  '/onboarding/',
  '/profile',
  '/security',
  '/history',
  '/communication',
  '/transactions-documents',
  '/my-adviser',
  '/ai-advisor',
  '/requests/',
  '/newsletter/',
  '/sign',
  '/verify',
  '/verify-document',
  '/og-preview',
  '/links',
  '/migration-helper',
  '/design-system',
  '/preview_page.html',
];

export const publicSeoRoutes = [
  {
    path: '/',
    lastmod: '2026-04-17',
    title: 'Navigate Wealth | Independent Financial Advisors in South Africa',
    description:
      'Navigate Wealth provides independent financial planning, investment management, retirement planning, risk management, tax planning and estate planning services across South Africa.',
    keywords:
      'financial advisor, wealth management, investment planning, retirement planning, risk management, tax planning, estate planning, South Africa, independent financial advisor',
    ogType: 'website',
    schema: 'home',
  },
  {
    path: '/services',
    lastmod: '2026-04-17',
    title: 'Our Services | Navigate Wealth',
    description:
      'Comprehensive wealth management services from Navigate Wealth: risk management, retirement planning, investments, medical aid, estate planning, tax planning, and employee benefits.',
    keywords:
      'financial services, wealth management, risk management, retirement planning, investment management, medical aid, estate planning, tax planning, employee benefits, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/resources',
    lastmod: '2026-04-17',
    title: 'Resources & Insights | Navigate Wealth',
    description:
      'Financial planning articles, market insights, and educational resources from Navigate Wealth. Stay informed with expert commentary on investments, retirement, tax, and more.',
    keywords:
      'financial planning articles, investment insights, retirement planning resources, tax planning guides, market commentary, Navigate Wealth blog, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/about',
    lastmod: '2026-03-01',
    title: 'About Us | Navigate Wealth',
    description:
      'Learn about Navigate Wealth, our mission, values, and the experienced team of independent financial advisors committed to helping you achieve financial independence.',
    keywords:
      'about navigate wealth, financial advisors team, independent financial planning, South Africa wealth management',
    ogType: 'website',
    schema: 'about',
  },
  {
    path: '/team',
    lastmod: '2026-03-01',
    title: 'Our Team | Meet the Advisors | Navigate Wealth',
    description:
      'Meet the experienced team of independent financial advisors at Navigate Wealth. Qualified professionals dedicated to your financial success across South Africa.',
    keywords:
      'Navigate Wealth team, financial advisors, certified financial planner, wealth management team, South Africa financial advisors',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/contact',
    lastmod: '2026-03-01',
    title: 'Contact Us | Navigate Wealth',
    description:
      'Get in touch with Navigate Wealth for a free consultation. Our independent financial advisors are ready to help you plan your financial future.',
    keywords:
      'contact navigate wealth, financial advisor consultation, free consultation, South Africa financial planning',
    ogType: 'website',
    schema: 'contact',
  },
  {
    path: '/schedule-consultation',
    lastmod: '2026-03-01',
    title: 'Schedule a Consultation | Navigate Wealth',
    description:
      'Schedule a consultation with Navigate Wealth to discuss independent financial planning, investment, retirement, risk, tax, estate, and medical aid advice.',
    keywords:
      'schedule consultation, financial advisor consultation, Navigate Wealth, financial planning South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/contact/consultation',
    sitemap: false,
    lastmod: '2026-03-01',
    title: 'Schedule a Consultation | Navigate Wealth',
    description:
      'Schedule a consultation with Navigate Wealth to discuss independent financial planning, investment, retirement, risk, tax, estate, and medical aid advice.',
    keywords:
      'schedule consultation, financial advisor consultation, Navigate Wealth, financial planning South Africa',
    canonicalPath: '/schedule-consultation',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/why-us',
    lastmod: '2026-03-01',
    title: 'Why Choose Navigate Wealth | Independent Financial Advisory',
    description:
      'Discover why Navigate Wealth is the trusted choice for independent financial advice in South Africa. Our independence, personalised approach, and commitment to long-term relationships set us apart.',
    keywords:
      'why Navigate Wealth, independent financial advisor, best financial planner South Africa, trusted wealth management, personalised financial advice',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/risk-management',
    lastmod: '2026-03-01',
    title: 'Risk Management | Life & Disability Cover | Navigate Wealth',
    description:
      'Independent risk management advice in South Africa. Life cover, disability, severe illness & income protection from leading insurers.',
    keywords:
      'risk management South Africa, life cover, disability insurance, income protection, severe illness cover, business insurance, buy and sell agreement, key person insurance, life insurance South Africa, independent insurance advisor, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Risk Management',
  },
  {
    path: '/retirement-planning',
    lastmod: '2026-03-01',
    title: 'Retirement Planning | Annuities & Pension Funds | Navigate Wealth',
    description:
      'Comprehensive retirement planning in South Africa. Retirement annuities, preservation funds, living annuities & pension funds from leading providers.',
    keywords:
      'retirement planning South Africa, retirement annuity, living annuity, pension fund, provident fund, preservation fund, retirement savings, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Retirement Planning',
  },
  {
    path: '/investment-management',
    lastmod: '2026-03-01',
    title: 'Investment Management | Navigate Wealth',
    description:
      'Professional investment management in South Africa. Unit trusts, tax-free savings, offshore investments & corporate fund solutions.',
    keywords:
      'investment management South Africa, unit trusts, tax free savings account, offshore investments, endowments, corporate investments, wealth management, Allan Gray, Sygnia, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Investment Management',
  },
  {
    path: '/tax-planning',
    lastmod: '2026-03-01',
    title: 'Tax Planning & Optimisation | Navigate Wealth',
    description:
      'Expert tax planning and optimisation for individuals and businesses in South Africa. Tax-efficient structures, estate duty planning, capital gains management, and corporate tax strategies.',
    keywords:
      'tax planning South Africa, tax optimisation, estate duty, capital gains tax, corporate tax, tax-free savings, tax deductions, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Tax Planning',
  },
  {
    path: '/estate-planning',
    lastmod: '2026-03-01',
    title: 'Estate Planning | Wills, Trusts & Succession | Navigate Wealth',
    description:
      'Comprehensive estate planning for individuals and businesses in South Africa. Wills, trusts, succession planning, estate duty optimisation, and business continuity from accredited specialists.',
    keywords:
      'estate planning South Africa, wills, trusts, succession planning, estate duty, inheritance, business succession, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Estate Planning',
  },
  {
    path: '/financial-planning',
    lastmod: '2026-03-01',
    title: 'Financial Planning | Wealth Strategy | Navigate Wealth',
    description:
      'Independent financial planning in South Africa. Strategies covering investments, retirement, tax, estate planning & debt management.',
    keywords:
      'financial planning South Africa, comprehensive financial plan, wealth strategy, retirement planning, investment strategy, tax planning, estate planning, debt management, certified financial planner, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Financial Planning',
  },
  {
    path: '/medical-aid',
    lastmod: '2026-03-01',
    title: 'Medical Aid & Health Insurance | Navigate Wealth',
    description:
      'Independent medical aid advice for individuals and businesses in South Africa. Comprehensive plans, hospital plans, savings plans, group schemes, and corporate wellness from leading medical schemes.',
    keywords:
      'medical aid South Africa, health insurance, hospital plan, medical savings, gap cover, group medical scheme, corporate wellness, Discovery Health, Momentum Health, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Medical Aid Advice',
  },
  {
    path: '/employee-benefits',
    lastmod: '2026-03-01',
    title: 'Employee Benefits | Group Risk & Health | Navigate Wealth',
    description:
      'Tailored employee benefits for businesses in South Africa. Group risk cover, retirement funds, medical aid & wellness programmes.',
    keywords:
      'employee benefits South Africa, group risk cover, group retirement fund, group medical aid, corporate wellness, employee wellness, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Employee Benefits',
  },
  {
    path: '/get-quote',
    lastmod: '2026-03-01',
    title: 'Get a Free Quote | Navigate Wealth',
    description:
      'Request a free, no-obligation quote for financial planning, insurance, investments, retirement, or medical aid. Our independent advisors compare the market to find the best solution for you.',
    keywords:
      'free financial quote, insurance quote South Africa, investment quote, retirement planning quote, medical aid quote, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/solutions/individuals',
    lastmod: '2026-03-01',
    title: 'Financial Planning for Individuals | Navigate Wealth',
    description:
      'Personal financial planning services for individuals in South Africa. Risk management, investments, retirement planning, tax optimisation, estate planning, and medical aid from independent advisors.',
    keywords:
      'personal financial planning, individual wealth management, personal insurance, investment advice, retirement planning individual, South Africa, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/solutions/businesses',
    lastmod: '2026-03-01',
    title: 'Financial Solutions for Businesses | Navigate Wealth',
    description:
      'Corporate financial services for businesses in South Africa. Employee benefits, group risk cover, business insurance, corporate investments, and tax planning from independent advisors.',
    keywords:
      'business financial planning, corporate wealth management, employee benefits, group risk cover, business insurance, corporate investments, South Africa, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/solutions/advisers',
    lastmod: '2026-03-01',
    title: 'For Financial Advisers | Partner with Navigate Wealth',
    description:
      'Join Navigate Wealth as an independent financial adviser. Access our technology platform, compliance support, product range, and collaborative network across South Africa.',
    keywords:
      'financial adviser partnership, independent adviser network, financial services franchise, adviser support platform, Navigate Wealth partnership, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/ask-vasco',
    lastmod: '2026-03-01',
    title: 'Ask Vasco | AI Financial Navigator | Navigate Wealth',
    description:
      'Ask Vasco, Navigate Wealth\'s public AI financial navigator, for general South African financial guidance on retirement, tax, risk cover, investing, and estate planning.',
    keywords:
      'AI financial navigator South Africa, financial planning chatbot, retirement questions, tax planning guidance, Navigate Wealth Vasco',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/careers',
    lastmod: '2026-03-01',
    title: 'Careers | Join Our Team | Navigate Wealth',
    description:
      'Explore career opportunities at Navigate Wealth. Join a dynamic team of independent financial advisors committed to helping South Africans achieve financial independence.',
    keywords:
      'Navigate Wealth careers, financial advisor jobs, wealth management careers, financial planning jobs South Africa, independent financial advisor vacancy',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/press',
    lastmod: '2026-03-01',
    title: 'Press & Media | Navigate Wealth',
    description:
      'Navigate Wealth press releases, media coverage, and company announcements. Access our media kit, brand assets, and the latest news from our financial advisory firm.',
    keywords:
      'Navigate Wealth press, media coverage, financial advisor news, press releases, media kit, South Africa financial services news',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/legal',
    lastmod: '2026-01-01',
    title: 'Legal & Compliance | Navigate Wealth',
    description:
      'Navigate Wealth legal documents, privacy policy, terms and conditions, POPIA compliance, FAIS disclosure, and regulatory information for our financial advisory services.',
    keywords:
      'Navigate Wealth legal, privacy policy, terms and conditions, POPIA, FAIS disclosure, financial services compliance, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
];

export function normalizeSiteUrl(value) {
  const trimmed = String(value || DEFAULT_SITE_URL).trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

export function routeCanonicalPath(route) {
  return route.canonicalPath || route.path;
}

export function absoluteUrl(siteUrl, routePath) {
  return routePath === '/' ? siteUrl : `${siteUrl}${routePath}`;
}

export function resolveImageUrl(siteUrl, value) {
  if (!value) return `${siteUrl}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createOrganizationSchema(siteUrl) {
  return {
    '@type': ['Organization', 'FinancialService'],
    '@id': `${siteUrl}/#organization`,
    name: DEFAULT_BUSINESS_NAME,
    legalName: 'Wealthfront (Pty) Ltd trading as Navigate Wealth',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/brand-assets/navigate-wealth-social.png`,
    },
    description:
      'Independent financial advisory firm providing comprehensive wealth management services across South Africa.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Milestone Place Block A, 25 Sovereign Dr Route 21 Business Park',
      addressLocality: 'Pretoria',
      addressRegion: 'Gauteng',
      postalCode: '0178',
      addressCountry: 'ZA',
    },
    areaServed: {
      '@type': 'Country',
      name: 'South Africa',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: DEFAULT_BUSINESS_PHONE,
      email: DEFAULT_BUSINESS_EMAIL,
      availableLanguage: ['English', 'Afrikaans'],
    },
    telephone: DEFAULT_BUSINESS_PHONE,
    email: DEFAULT_BUSINESS_EMAIL,
    priceRange: '$$',
    knowsAbout: [
      'Financial Planning',
      'Wealth Management',
      'Investment Management',
      'Retirement Planning',
      'Risk Management',
      'Tax Planning',
      'Estate Planning',
      'Employee Benefits',
      'Medical Aid',
    ],
    sameAs: [
      'https://www.linkedin.com/company/navigatewealth/',
      'https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA==',
      'https://www.youtube.com/@navigatewealth',
    ],
  };
}

export function createWebSiteSchema(siteUrl) {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: 'Navigate Wealth',
    url: siteUrl,
    publisher: { '@id': `${siteUrl}/#organization` },
    inLanguage: DEFAULT_LANGUAGE,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/resources?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function createWebPageSchema(route, siteUrl) {
  const url = absoluteUrl(siteUrl, routeCanonicalPath(route));
  return {
    '@type': route.schema === 'about' ? 'AboutPage' : route.schema === 'contact' ? 'ContactPage' : 'WebPage',
    '@id': `${url}#webpage`,
    name: route.title,
    description: route.description,
    url,
    inLanguage: DEFAULT_LANGUAGE,
    ...(route.lastmod ? { dateModified: route.lastmod } : {}),
    isPartOf: { '@id': `${siteUrl}/#website` },
    publisher: { '@id': `${siteUrl}/#organization` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
  };
}

export function createBreadcrumbSchema(route, siteUrl) {
  const crumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: siteUrl,
    },
  ];

  if (route.path !== '/') {
    const pathParts = route.path.split('/').filter(Boolean);
    let partial = '';
    pathParts.forEach((part, index) => {
      partial += `/${part}`;
      crumbs.push({
        '@type': 'ListItem',
        position: index + 2,
        name: part
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        item: absoluteUrl(siteUrl, partial),
      });
    });
  }

  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(siteUrl, routeCanonicalPath(route))}#breadcrumb`,
    itemListElement: crumbs,
  };
}

export function createServiceSchema(route, siteUrl) {
  return {
    '@type': 'FinancialService',
    '@id': `${absoluteUrl(siteUrl, route.path)}#service`,
    name: route.serviceType || route.title.replace(/\s*\|.*$/, ''),
    description: route.description,
    url: absoluteUrl(siteUrl, route.path),
    serviceType: route.serviceType || 'Financial Advisory Services',
    provider: { '@id': `${siteUrl}/#organization` },
    inLanguage: DEFAULT_LANGUAGE,
    areaServed: {
      '@type': 'Country',
      name: 'South Africa',
    },
  };
}

export function createRouteSchema(route, siteUrl) {
  const graph = [
    createOrganizationSchema(siteUrl),
    createWebSiteSchema(siteUrl),
    createWebPageSchema(route, siteUrl),
  ];

  graph.push(createBreadcrumbSchema(route, siteUrl));

  if (route.schema === 'service') {
    graph.push(createServiceSchema(route, siteUrl));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function createStaticBodyHtml(route, siteUrl) {
  const canonicalUrl = absoluteUrl(siteUrl, routeCanonicalPath(route));
  const pageName = stripTitleSuffix(route.title);
  const crumbs = breadcrumbItemsForRoute(route, siteUrl);
  const serviceLine = route.serviceType
    ? `<p><strong>Service:</strong> ${escapeHtml(route.serviceType)} for clients in South Africa.</p>`
    : '';
  const articleLine = route.schema === 'article'
    ? '<p>This article is part of the Navigate Wealth resources and insights library.</p>'
    : '';

  return `
      <!-- static-body:start -->
      <noscript data-seo-static-body="true">
        <main id="seo-static-body" aria-label="${escapeHtml(pageName)}">
          <article>
            <nav aria-label="Breadcrumb">
              <ol>
${crumbs
  .map(
    (crumb) =>
      `                <li><a href="${escapeHtml(crumb.url)}">${escapeHtml(crumb.name)}</a></li>`
  )
  .join('\n')}
              </ol>
            </nav>
            <header>
              <p>${escapeHtml(DEFAULT_BUSINESS_NAME)}</p>
              <h1>${escapeHtml(pageName)}</h1>
              <p>${escapeHtml(route.description)}</p>
            </header>
            ${serviceLine}
            ${articleLine}
            <p><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(pageName)}</a></p>
          </article>
        </main>
      </noscript>
      <!-- static-body:end -->`;
}

export function stripTitleSuffix(title) {
  return String(title || DEFAULT_BUSINESS_NAME)
    .replace(/\s*\|\s*Navigate Wealth\s*$/i, '')
    .trim();
}

function breadcrumbItemsForRoute(route, siteUrl) {
  const items = [{ name: 'Home', url: siteUrl }];
  const canonicalPath = routeCanonicalPath(route);
  if (canonicalPath === '/') return items;

  let partial = '';
  for (const part of canonicalPath.split('/').filter(Boolean)) {
    partial += `/${part}`;
    items.push({
      name: part
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      url: absoluteUrl(siteUrl, partial),
    });
  }

  return items;
}

export function createArticleRoute(article, siteUrl) {
  const slug = typeof article?.slug === 'string' ? article.slug.trim() : '';
  if (!slug) return null;

  const path = `/resources/article/${encodeURIComponent(slug)}`;
  const title = `${article.title || 'Financial Planning Article'} | Navigate Wealth`;
  const description =
    article.excerpt ||
    article.subtitle ||
    'Financial planning article from Navigate Wealth with insights on investments, retirement, tax, risk management, and estate planning.';
  const image =
    article.hero_image_url ||
    article.featured_image_url ||
    article.feature_image_url ||
    article.featured_image ||
    article.thumbnail_image_url ||
    DEFAULT_OG_IMAGE_PATH;

  return {
    path,
    lastmod: article.updated_at || article.published_at || article.created_at,
    title,
    description,
    keywords: Array.isArray(article.tags) ? article.tags.join(', ') : '',
    ogType: 'article',
    ogImage: image,
    schema: 'article',
    article,
  };
}

export function createArticleSchema(route, siteUrl) {
  const article = route.article || {};
  const canonical = absoluteUrl(siteUrl, route.path);
  const image = resolveImageUrl(siteUrl, route.ogImage);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganizationSchema(siteUrl),
      createWebSiteSchema(siteUrl),
      createBreadcrumbSchema(route, siteUrl),
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: article.title || route.title,
        description: route.description,
        image,
        inLanguage: DEFAULT_LANGUAGE,
        author: {
          '@type': 'Person',
          name: article.author_name || 'Navigate Wealth Editorial Team',
        },
        publisher: { '@id': `${siteUrl}/#organization` },
        ...(article.published_at ? { datePublished: article.published_at } : {}),
        ...(article.updated_at ? { dateModified: article.updated_at } : {}),
        mainEntityOfPage: canonical,
        url: canonical,
      },
    ],
  };
}
