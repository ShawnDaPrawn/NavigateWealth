/**
 * NavigatorResourcesPage — the redesigned Resources page (/resources).
 *
 * It reads what the live page reads (ResourcesPage.tsx), through the live
 * page's own hooks: published articles and active categories from the
 * publications module, market news from the RSS proxy, newsletters from the
 * public newsletter route. It keeps the live page's addresses: `?section=`
 * opens a tab (the footer links to market-updates and newsletters, the home
 * page to insights), changing tab rewrites it, and `?q=` carries a search, as
 * the WebSite SearchAction sitelinks expect. It emits the same SEO tags and
 * JSON-LD.
 *
 * The layout is the "Resources" board of the Website Redesign canvas. Beyond
 * the live page it shows the editors' featured articles and loads the library
 * nine at a time; every count it shows is counted from the data.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import {
  useArticles,
  useCategories,
  useMarketNews,
} from '../../components/admin/modules/publications';
import { usePublishedNewsletters } from '../../components/pages/resources/useNewsletters';
import {
  readResourcesSearchQuery,
  writeResourcesSearchQuery,
} from '../../components/pages/resourcesSearch';
import { ResourcesAskVasco } from '../sections/ResourcesAskVasco';
import { ResourcesHero } from '../sections/ResourcesHero';
import { ResourcesInsights } from '../sections/ResourcesInsights';
import { ResourcesMarketNews } from '../sections/ResourcesMarketNews';
import { ResourcesMarketWatch } from '../sections/ResourcesMarketWatch';
import { ResourcesNewsletters } from '../sections/ResourcesNewsletters';
import type { NewsletterSignup, SignupOutcome } from '../sections/ResourcesSignup';
import { ResourcesTabs, type ResourcesTab } from '../sections/ResourcesTabs';
import {
  buildTopics,
  featuredArticles,
  groupByTopic,
  isResourceSection,
  searchResources,
  sortByRecent,
  type NewsFeeds,
  type ResourceSection,
} from '../sections/resourcesModel';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/resources.css';

/** The live page's search waits this long after the last keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

const TAB_LABELS: Record<ResourceSection, string> = {
  insights: 'Insights & Education',
  'market-watch': 'Market Watch',
  'market-updates': 'Market News',
  newsletters: 'Newsletters',
};

export function NavigatorResourcesPage() {
  const seoData = getSEOData('resources');
  const base = useId();
  const tabId = useCallback((key: ResourceSection) => `${base}-tab-${key}`, [base]);
  const panelId = useCallback((key: ResourceSection) => `${base}-panel-${key}`, [base]);
  const tabBar = useRef<HTMLDivElement>(null);
  // One outcome for both sign-up forms, so they agree once someone subscribes.
  const [signupOutcome, setSignupOutcome] = useState<SignupOutcome | null>(null);
  const signup: NewsletterSignup = { outcome: signupOutcome, setOutcome: setSignupOutcome };

  // ── Section, from ?section= ──
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const [activeTab, setActiveTab] = useState<ResourceSection>(() =>
    isResourceSection(sectionParam) ? sectionParam : 'insights',
  );
  useEffect(() => {
    if (isResourceSection(sectionParam)) setActiveTab(sectionParam);
  }, [sectionParam]);

  const [watchSection, setWatchSection] = useState('overview');
  const [newsSection, setNewsSection] = useState('economic-news');

  // ── Data: the live page's hooks ──
  const { categories, isLoading: categoriesLoading } = useCategories({ activeOnly: true });
  const { articles, isLoading: articlesLoading } = useArticles({ status: 'published' });
  const newsQuery = useMarketNews(activeTab === 'market-updates');
  // Fetched up front, not only when its tab opens: the tab shows the count.
  const { data: newsletters = [], isLoading: newslettersLoading } = usePublishedNewsletters(true);
  const news = newsQuery.data as NewsFeeds | undefined;

  const sorted = useMemo(() => [...articles].sort(sortByRecent), [articles]);
  const topics = useMemo(() => buildTopics(categories), [categories]);
  const byTopic = useMemo(() => groupByTopic(sorted, topics), [sorted, topics]);
  const featured = useMemo(() => featuredArticles(sorted), [sorted]);
  const insightsLoading = categoriesLoading || articlesLoading;

  // ── Search, kept in ?q= ──
  const urlQuery = readResourcesSearchQuery(searchParams);
  const [query, setQuery] = useState(urlQuery);
  const [applied, setApplied] = useState(urlQuery);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A sitelink or a shared /resources?q=… link fills the box and searches.
  useEffect(() => {
    setQuery((current) => (current.trim() === urlQuery ? current : urlQuery));
    setApplied(urlQuery);
  }, [urlQuery]);
  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const results = useMemo(() => searchResources(applied, sorted, news), [applied, sorted, news]);
  const pending = query.trim() !== applied.trim();

  const writeQuery = useCallback(
    (value: string) => {
      setSearchParams((prev) => writeResourcesSearchQuery(prev, value), { replace: true });
    },
    [setSearchParams],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setApplied(value);
      writeQuery(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const clearSearch = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setQuery('');
    setApplied('');
    writeQuery('');
  }, [writeQuery]);

  const pickTerm = (term: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    setQuery(term);
    setApplied(term);
    writeQuery(term);
  };

  // ── Tabs ──
  const selectTab = useCallback(
    (key: ResourceSection) => {
      setActiveTab(key);
      if (debounce.current) clearTimeout(debounce.current);
      setQuery('');
      setApplied('');
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('section', key);
          return writeResourcesSearchQuery(next, '');
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const readPastIssues = () => {
    selectTab('newsletters');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    tabBar.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const tabs: ResourcesTab[] = [
    { key: 'insights', label: TAB_LABELS.insights, count: insightsLoading ? 0 : sorted.length },
    { key: 'market-watch', label: TAB_LABELS['market-watch'] },
    { key: 'market-updates', label: TAB_LABELS['market-updates'] },
    { key: 'newsletters', label: TAB_LABELS.newsletters, count: newsletters.length },
  ];

  return (
    <div className="nw-site nwrs">
      <SEO
        {...seoData}
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />

      <ResourcesHero
        query={query}
        pending={pending}
        results={results}
        articleCount={insightsLoading ? 0 : sorted.length}
        onQueryChange={onQueryChange}
        onPickTerm={pickTerm}
        onClear={clearSearch}
      />

      <ResourcesTabs
        ref={tabBar}
        tabs={tabs}
        active={activeTab}
        onSelect={selectTab}
        tabId={tabId}
        panelId={panelId}
      />

      <div id={panelId(activeTab)} role="tabpanel" aria-labelledby={tabId(activeTab)}>
        {activeTab === 'insights' ? (
          <ResourcesInsights
            loading={insightsLoading}
            featured={featured}
            topics={topics}
            byTopic={byTopic}
            total={sorted.length}
            signup={signup}
            onReadPastIssues={readPastIssues}
          />
        ) : null}
        {activeTab === 'market-watch' ? (
          <ResourcesMarketWatch active={watchSection} onSelect={setWatchSection} />
        ) : null}
        {activeTab === 'market-updates' ? (
          <ResourcesMarketNews
            active={newsSection}
            onSelect={setNewsSection}
            news={news}
            loading={newsQuery.isLoading}
            refreshing={newsQuery.isFetching}
            updatedAt={newsQuery.dataUpdatedAt}
            onRefresh={() => void newsQuery.refetch()}
          />
        ) : null}
        {activeTab === 'newsletters' ? (
          <ResourcesNewsletters
            newsletters={newsletters}
            loading={newslettersLoading}
            signup={signup}
          />
        ) : null}
      </div>

      <ResourcesAskVasco />
    </div>
  );
}

export default NavigatorResourcesPage;
