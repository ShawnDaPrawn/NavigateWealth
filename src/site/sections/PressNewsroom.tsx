/**
 * PressNewsroom — "Featured News": the press releases, a search box and the
 * category tabs.
 *
 * It reads the same press articles as the live press page, from the same
 * server route, and filters them the same way. The tabs are the live page's
 * four: "Awards" and "Team News" stay labels only, because an empty "Awards"
 * tab reads as a claim the firm has awards.
 *
 * The board draws the newsroom with nothing published, so the empty state is
 * the board's. Published releases use the Navigator article card the home
 * page's insights use, and while the list loads the empty-state frame holds
 * its place with a status line.
 *
 * The tabs follow the WAI-ARIA tabs pattern: one tab stop, arrow keys, Home
 * and End move between them, and the results are their tab panel.
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { articlePath } from '../../components/shared/useFeaturedArticles';
import { projectId } from '../../utils/supabase/info';
import { PressIcon } from './PressIcons';
import { SectionHead } from './SectionHead';
import { formatCardDate } from './format';
import '../styles/sections.css';
import '../styles/home.css';
import '../styles/press.css';

export interface PressArticle {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  press_category: string;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  published_at?: string;
  author_name?: string;
  reading_time_minutes?: number;
}

/**
 * The live press page's endpoint (PressPage.tsx). It is a public route and the
 * function runs with verify_jwt off, so no Authorization header is sent: the
 * anon key is not a credential (see anon-key-bearer-ratchet.test.ts), and a
 * visitor's session has nothing to add here.
 */
const PRESS_ARTICLES_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/press/articles`;

const PRESS_CATEGORY_MAP: Record<string, string> = {
  'Company News': 'company_news',
  'Product Launch': 'product_launch',
  Awards: 'awards',
  'Team News': 'team_news',
  'Industry Insights': 'industry_insights',
};

const PRESS_CATEGORY_LABEL_MAP: Record<string, string> = {
  company_news: 'Company News',
  product_launch: 'Product Launch',
  awards: 'Awards',
  team_news: 'Team News',
  industry_insights: 'Industry Insights',
};

const PRESS_CATEGORY_TABS = ['All', 'Company News', 'Product Launch', 'Industry Insights'];

/** Any failure resolves to no articles, as on the live page. */
function usePressArticles(): { articles: PressArticle[]; loading: boolean } {
  const [articles, setArticles] = useState<PressArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(PRESS_ARTICLES_URL)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success && Array.isArray(json.data)) setArticles(json.data);
      })
      .catch(() => {
        /* no articles */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { articles, loading };
}

function filterArticles(articles: PressArticle[], category: string, query: string) {
  let result = articles;
  if (category !== 'All') {
    const key = PRESS_CATEGORY_MAP[category];
    if (key) result = result.filter((a) => a.press_category === key);
  }
  const q = query.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        (a.subtitle || '').toLowerCase().includes(q),
    );
  }
  return result;
}

interface PressNewsroomProps {
  index: string;
  title: string;
  lead: string;
  contactLink: string;
}

export function PressNewsroom({ index, title, lead, contactLink }: PressNewsroomProps) {
  const base = useId();
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = `${base}-panel`;
  const searchId = `${base}-search`;
  const { articles, loading } = usePressArticles();
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const shown = useMemo(
    () => filterArticles(articles, category, query),
    [articles, category, query],
  );
  const filtering = category !== 'All' || query.trim().length > 0;
  const selected = PRESS_CATEGORY_TABS.indexOf(category);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = PRESS_CATEGORY_TABS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (i + 1) % (last + 1)
        : event.key === 'ArrowLeft'
          ? (i + last) % (last + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setCategory(PRESS_CATEGORY_TABS[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="nwpr2-news" aria-labelledby="nwpr2-news-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Newsroom"
          title={title}
          lead={lead}
          titleId="nwpr2-news-title"
          className="nwpr2-head"
        />

        <div className="nwpr2-filters">
          <div className="nwpr2-search">
            <label htmlFor={searchId} className="nw-sr-only">
              Search press releases
            </label>
            <PressIcon name="search" size={17} stroke="#5E6676" />
            <input
              id={searchId}
              className="nwpr2-search-input"
              type="search"
              placeholder="Search press releases..."
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            />
          </div>
          <div role="tablist" aria-label="Press categories" className="nwpr2-tabs">
            {PRESS_CATEGORY_TABS.map((label, i) => {
              const on = i === selected;
              return (
                <button
                  key={label}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={tabId(i)}
                  aria-selected={on}
                  aria-controls={panelId}
                  tabIndex={on ? 0 : -1}
                  className="nwpr2-tab"
                  onClick={() => setCategory(label)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(selected)}
          aria-busy={loading}
          className="nwpr2-panel"
        >
          {loading ? (
            <div className="nwpr2-empty">
              <div className="nwpr2-empty-icon" aria-hidden="true">
                <PressIcon name="newspaper" size={34} strokeWidth={1.7} />
              </div>
              <p className="nwpr2-empty-help" role="status">
                Loading press releases…
              </p>
            </div>
          ) : shown.length === 0 ? (
            <div className="nwpr2-empty">
              <div className="nwpr2-empty-icon" aria-hidden="true">
                <PressIcon name="newspaper" size={34} strokeWidth={1.7} />
              </div>
              <h3 className="nwpr2-empty-title">
                {filtering ? 'No Matching Results' : 'No News Available'}
              </h3>
              <p className="nwpr2-empty-text">
                {filtering
                  ? 'Try adjusting your search or category filter to find press releases.'
                  : "We don't have any press releases or news announcements to share at the moment. Please check back soon for updates on our latest developments and company news."}
              </p>
              <p className="nwpr2-empty-help">
                For immediate assistance or inquiries, please contact us directly.
              </p>
              <Link className="nw-btn nwpr2-empty-cta" to={contactLink}>
                Contact Us <PressIcon name="arrowRight" size={16} />
              </Link>
            </div>
          ) : (
            <ul className="nwin-grid nwpr2-articles">
              {shown.map((article) => (
                <li key={article.id}>
                  <PressArticleCard article={article} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function PressArticleCard({ article }: { article: PressArticle }) {
  const image = article.hero_image_url || article.thumbnail_image_url || '';
  const date = formatCardDate(article.published_at);
  const label = PRESS_CATEGORY_LABEL_MAP[article.press_category] || article.press_category;
  return (
    <Link className="nwin-card" to={articlePath(article.slug)}>
      {image ? (
        <span className="nwin-img">
          <img src={image} alt="" loading="lazy" decoding="async" />
        </span>
      ) : null}
      <span className="nwin-meta nw-mono">
        <span className="nwin-cat">{label}</span>
        {date ? <span>{date}</span> : null}
      </span>
      <h3 className="nwin-title">{article.title}</h3>
      {article.excerpt ? <span className="nwin-excerpt nw-clamp3">{article.excerpt}</span> : null}
      <span className="nwin-foot">
        <span className="nwin-read nw-mono">
          {article.reading_time_minutes ? `${article.reading_time_minutes} min read` : ''}
        </span>
        <span className="nwin-go" aria-hidden="true">
          Read article
          <ArrowRight size={15} strokeWidth={1.75} />
        </span>
      </span>
    </Link>
  );
}
