import * as kv from './kv_store.tsx';
import { generateFullArticle } from './publications-ai-service.ts';
import type { GenerateArticleBrief } from './publications-ai-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  CalendarEvent,
  ContentSource,
  PipelineConfig,
  PipelineId,
  PipelineTriggerResult,
} from './auto-content-types.ts';
import {
  calendarKey,
  CALENDAR_PREFIX,
  createDraftArticle,
  DEFAULT_NEWS_FEEDS,
  fetchRSSItems,
  getAvailableCategoryNames,
  getDefaultTypeId,
  getRecentlyUsedImageIds,
  getSourcesForPipeline,
  incrementSourceCounters,
  isTopicDuplicate,
  markSourceChecked,
  processedKey,
  recordTopicHash,
  recordUsedImage,
  simpleHash,
} from './auto-content-pipeline-helpers.ts';
import type { RSSItem } from './auto-content-pipeline-helpers.ts';

const log = createModuleLogger('auto-content');

// ---------------------------------------------------------------------------
// Pipeline 1: Market Commentary
// ---------------------------------------------------------------------------

async function runMarketCommentary(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];
  let sources: ContentSource[] = [];

  try {
    // Resolve sources for this pipeline
    const resolved = await getSourcesForPipeline('market_commentary');
    const feedUrls = resolved.urls;
    sources = resolved.sources;

    // Fetch latest market news headlines
    const allItems: RSSItem[] = [];
    for (const feedUrl of feedUrls) {
      const items = await fetchRSSItems(feedUrl);
      allItems.push(...items);
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Build headlines context — may be empty if RSS feeds are unreachable
    let headlinesContext = '';
    if (allItems.length > 0) {
      // Dedup — check if we've recently generated from similar headlines
      const headlinesSummary = allItems
        .slice(0, 5)
        .map((i) => i.title)
        .join(' | ');
      const hash = simpleHash(headlinesSummary);
      const alreadyProcessed = await kv.get(processedKey('market_commentary', hash));
      if (alreadyProcessed) {
        return {
          pipelineId: 'market_commentary',
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: 'Similar market headlines already processed recently',
          errors: [],
          durationMs: Date.now() - start,
        };
      }

      headlinesContext = allItems
        .slice(0, 8)
        .map(
          (item, i) =>
            `${i + 1}. ${item.title} (${new Date(item.pubDate).toLocaleDateString('en-ZA')})`,
        )
        .join('\n');
    } else {
      // No RSS items — check weekly dedup using date-based hash instead
      const weekNum = Math.ceil(
        (today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
      const weekHash = simpleHash(`market_commentary_weekly_${today.getFullYear()}_${weekNum}`);
      const alreadyProcessed = await kv.get(processedKey('market_commentary', weekHash));
      if (alreadyProcessed) {
        return {
          pipelineId: 'market_commentary',
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: 'Weekly market commentary already generated (RSS feeds unavailable)',
          errors: ['RSS feeds returned no items — used general market knowledge'],
          durationMs: Date.now() - start,
        };
      }

      log.info('RSS feeds returned no items — generating market commentary from general knowledge');
    }

    // Auto-category: pass available categories when no explicit category configured
    const categoryContext = !config.categoryId
      ? await getAvailableCategoryNames()
      : { names: [], categories: [] };

    const brief: GenerateArticleBrief = {
      topic: `Weekly Market Commentary — ${dateStr}`,
      audience: config.audience,
      tone: config.tone,
      targetLength: config.targetLength,
      categoryName: config.categoryName || 'Market Updates',
      keyPoints: [
        'South African market performance (JSE All Share, Top 40)',
        'Rand exchange rate movements against major currencies',
        'Key economic indicators (inflation, interest rates, GDP)',
        'Global market context and how it affects SA investors',
        'Outlook and what investors should watch for next week',
      ],
      additionalInstructions: headlinesContext
        ? `Use these recent headlines as context for your commentary — transform all source material into entirely original Navigate Wealth content. Never mention, cite, or attribute the original publications. Preserve all numerical data (percentages, rand values, dates, thresholds) precisely with no omissions.\n\n${headlinesContext}\n\nToday's date is ${dateStr}. Write as a regular weekly market update for Navigate Wealth clients. Conclude with a decisive strategic advisory takeaway that positions Navigate Wealth as the trusted partner for navigating market complexity.`
        : `Today's date is ${dateStr}. Write a weekly market update for Navigate Wealth clients. Provide original market commentary covering SA and global markets, key economic indicators, and outlook. Include specific numerical context where possible (index levels, rand exchange rates, inflation figures). Conclude with a decisive strategic advisory takeaway that reinforces the value of working with a Navigate Wealth financial adviser.`,
      ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
    };

    // Stale image prevention: load recently used image IDs
    const excludeImageIds = await getRecentlyUsedImageIds();
    const result = await generateFullArticle(brief, { excludeImageIds });

    // Track used image
    if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

    const typeId = await getDefaultTypeId();
    const articleId = await createDraftArticle(
      result,
      config.categoryId || '',
      typeId,
      'market_commentary',
    );
    articleIds.push(articleId);

    // Mark as processed — use headline hash if available, otherwise week-based hash
    const dedupHash =
      allItems.length > 0
        ? simpleHash(
            allItems
              .slice(0, 5)
              .map((i) => i.title)
              .join(' | '),
          )
        : simpleHash(
            `market_commentary_weekly_${today.getFullYear()}_${Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`,
          );
    await kv.set(processedKey('market_commentary', dedupHash), {
      processedAt: new Date().toISOString(),
      articleId,
    });

    // Update source counters
    for (const src of sources) {
      await incrementSourceCounters(src, 1);
    }

    return {
      pipelineId: 'market_commentary',
      status: 'success',
      articlesGenerated: 1,
      articleIds,
      summary: `Generated market commentary: "${result.title}"`,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('Market commentary pipeline failed', err);

    // Mark sources as checked even on failure
    for (const src of sources) {
      await markSourceChecked(src);
    }

    return {
      pipelineId: 'market_commentary',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline 2: Regulatory Change Monitor
// ---------------------------------------------------------------------------

// SA regulatory bodies to watch for in headlines
const REGULATORY_KEYWORDS = [
  'FSCA',
  'SARB',
  'National Treasury',
  'FAIS',
  'FICA',
  'POPIA',
  'Reserve Bank',
  'Financial Sector',
  'regulation',
  'regulatory',
  'compliance',
  'pension fund',
  'retirement',
  'tax amendment',
  'exchange control',
  'crypto regulation',
  'insurance act',
  'financial advisory',
  'conduct authority',
  'prudential',
];

async function runRegulatoryMonitor(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];

  try {
    // Resolve sources for this pipeline
    const {
      urls: feedUrls,
      sources,
      filterKeywords: sourceKeywords,
    } = await getSourcesForPipeline('regulatory_monitor');

    // Merge source-level keywords with the global defaults
    const effectiveKeywords = sourceKeywords.length > 0 ? sourceKeywords : REGULATORY_KEYWORDS;

    // Fetch news and filter for regulatory content
    const allItems: RSSItem[] = [];
    for (const feedUrl of feedUrls) {
      const items = await fetchRSSItems(feedUrl);
      allItems.push(...items);
    }

    // Filter for regulatory-relevant items
    const regulatoryItems = allItems.filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return effectiveKeywords.some((kw) => text.includes(kw.toLowerCase()));
    });

    if (regulatoryItems.length === 0) {
      return {
        pipelineId: 'regulatory_monitor',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'No regulatory-relevant news items detected',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Auto-category + stale image prevention
    const categoryContext = !config.categoryId
      ? await getAvailableCategoryNames()
      : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    // Dedup
    for (const item of regulatoryItems.slice(0, 3)) {
      const hash = simpleHash(item.title);
      const alreadyProcessed = await kv.get(processedKey('regulatory_monitor', hash));
      if (alreadyProcessed) continue;

      // Cross-pipeline dedup: skip if another pipeline already covered this topic
      if (await isTopicDuplicate(item.title, 'regulatory_monitor')) {
        log.info('Skipping regulatory item — already covered by another pipeline', {
          title: item.title,
        });
        continue;
      }

      try {
        const brief: GenerateArticleBrief = {
          topic: `Regulatory Update: ${item.title}`,
          audience: config.audience,
          tone: config.tone || 'authoritative',
          targetLength: config.targetLength || 'medium',
          categoryName: config.categoryName || 'Regulatory Updates',
          keyPoints: [
            'What changed or was announced',
            'Which financial services professionals and clients are affected',
            'What advisors need to do in response',
            'Timeline for compliance or implementation',
            'Practical next steps and recommendations',
          ],
          additionalInstructions: `Transform the following regulatory news into an entirely original Navigate Wealth article. Never mention, cite, or attribute the original source publication in any way. Preserve ALL numerical data — exact percentages, rand amounts, thresholds, effective dates, and limits — with absolutely no omissions or generalisations.\n\nSource context:\nTitle: ${item.title}\nSummary: ${item.description}\nDate: ${item.pubDate}\n\nWrite an original explanatory article that translates this regulatory development into clear, actionable guidance for Navigate Wealth clients. Reference the relevant legislation (FAIS Act, FICA, POPIA, etc.) where applicable. Explain the long-term wealth implications and conclude with a decisive strategic advisory takeaway that positions Navigate Wealth as the trusted adviser for navigating regulatory complexity.`,
          ...(categoryContext.names.length > 0
            ? { availableCategories: categoryContext.names }
            : {}),
        };

        const result = await generateFullArticle(brief, { excludeImageIds });

        if (result.unsplashPhotoId) {
          await recordUsedImage(result.unsplashPhotoId);
          excludeImageIds.add(result.unsplashPhotoId); // Also exclude within this run
        }

        const typeId = await getDefaultTypeId();
        const articleId = await createDraftArticle(
          result,
          config.categoryId || '',
          typeId,
          'regulatory_monitor',
        );
        articleIds.push(articleId);

        await kv.set(processedKey('regulatory_monitor', hash), {
          processedAt: new Date().toISOString(),
          articleId,
          sourceTitle: item.title,
        });

        // Update source counters
        for (const src of sources) {
          await incrementSourceCounters(src, 1);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        errors.push(`Failed to generate article for "${item.title}": ${msg}`);
        log.error('Regulatory article generation failed', { title: item.title, error: msg });
      }
    }

    return {
      pipelineId: 'regulatory_monitor',
      status: articleIds.length > 0 ? (errors.length > 0 ? 'partial' : 'success') : 'error',
      articlesGenerated: articleIds.length,
      articleIds,
      summary:
        articleIds.length > 0
          ? `Generated ${articleIds.length} regulatory update article(s)`
          : 'No articles generated — all items were previously processed or failed',
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('Regulatory monitor pipeline failed', err);
    return {
      pipelineId: 'regulatory_monitor',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline 3: News Commentary
// ---------------------------------------------------------------------------

async function runNewsCommentary(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];

  try {
    // Resolve sources for this pipeline
    const { urls: feedUrls, sources } = await getSourcesForPipeline('news_commentary');

    // If no managed sources returned URLs, also check the legacy config.rssFeeds
    const effectiveFeeds =
      feedUrls.length > 0
        ? feedUrls
        : config.rssFeeds?.length
          ? config.rssFeeds
          : DEFAULT_NEWS_FEEDS;

    const allItems: RSSItem[] = [];
    for (const feedUrl of effectiveFeeds) {
      const items = await fetchRSSItems(feedUrl);
      allItems.push(...items);
    }

    // When RSS feeds return nothing, generate a general financial commentary
    if (allItems.length === 0) {
      // Check dedup for general commentary
      const today = new Date();
      const dayHash = simpleHash(`news_commentary_general_${today.toISOString().slice(0, 10)}`);
      const alreadyDone = await kv.get(processedKey('news_commentary', dayHash));
      if (alreadyDone) {
        return {
          pipelineId: 'news_commentary',
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: 'General commentary already generated today (RSS feeds unavailable)',
          errors: ['RSS feeds returned no items'],
          durationMs: Date.now() - start,
        };
      }

      log.info('News RSS feeds returned no items — generating general financial commentary');

      const categoryContext = !config.categoryId
        ? await getAvailableCategoryNames()
        : { names: [], categories: [] };
      const excludeImageIds = await getRecentlyUsedImageIds();
      const dateStr = today.toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const brief: GenerateArticleBrief = {
        topic: `Navigate Wealth Perspective: Financial Markets Update — ${dateStr}`,
        audience: config.audience,
        tone: config.tone || 'professional',
        targetLength: config.targetLength || 'medium',
        categoryName: config.categoryName || 'Market Insights',
        keyPoints: [
          'Current South African economic landscape and key themes — include specific numerical data where possible',
          'Global market developments reframed for SA investors — rand exposure, offshore allocation implications',
          'Practical investment guidance interpreted through SA financial planning lens (Regulation 28, RAs, TFSAs)',
          'Key risks and opportunities — with decisive strategic advisory takeaway',
        ],
        additionalInstructions: `Today's date is ${dateStr}. Write an original thought-leadership commentary on current financial market themes and investment considerations for Navigate Wealth clients. Focus on South African market analysis, economic trends, and practical guidance interpreted through an SA financial planning lens — incorporate SARS implications, Regulation 28, retirement annuities, TFSAs, rand versus offshore allocation, and JSE dynamics where relevant. Include specific numerical context where possible. Conclude with a decisive strategic advisory takeaway that reinforces the value of working with a Navigate Wealth financial adviser.`,
        ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
      };

      const result = await generateFullArticle(brief, { excludeImageIds });

      if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

      const typeId = await getDefaultTypeId();
      const articleId = await createDraftArticle(
        result,
        config.categoryId || '',
        typeId,
        'news_commentary',
      );

      await kv.set(processedKey('news_commentary', dayHash), {
        processedAt: new Date().toISOString(),
        articleId,
      });

      for (const src of sources) {
        await incrementSourceCounters(src, 1);
      }

      return {
        pipelineId: 'news_commentary',
        status: 'success',
        articlesGenerated: 1,
        articleIds: [articleId],
        summary: `Generated general financial commentary: "${result.title}" (RSS feeds unavailable)`,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Pick the most interesting/relevant items not yet processed
    const unprocessed: RSSItem[] = [];
    for (const item of allItems) {
      const hash = simpleHash(item.title);
      const exists = await kv.get(processedKey('news_commentary', hash));
      if (!exists) {
        unprocessed.push(item);
      }
      if (unprocessed.length >= 3) break; // Max 3 per run
    }

    if (unprocessed.length === 0) {
      return {
        pipelineId: 'news_commentary',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'All recent news items have already been processed',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Cross-pipeline dedup: check if main topic already covered
    const mainTopic = unprocessed[0].title;
    if (await isTopicDuplicate(mainTopic, 'news_commentary')) {
      return {
        pipelineId: 'news_commentary',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'Topic already covered by another pipeline — skipping to avoid duplicate',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Generate one consolidated commentary from the top items
    const newsContext = unprocessed
      .map(
        (item, i) =>
          `${i + 1}. ${item.title}\n   ${item.description?.slice(0, 200) || ''}\n   Published: ${new Date(item.pubDate).toLocaleDateString('en-ZA')}`,
      )
      .join('\n\n');

    // Auto-category + stale image prevention
    const categoryContext = !config.categoryId
      ? await getAvailableCategoryNames()
      : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    const brief: GenerateArticleBrief = {
      topic:
        unprocessed.length === 1
          ? `Navigate Wealth Perspective: ${unprocessed[0].title}`
          : 'Financial News Round-Up: Navigate Wealth Perspective',
      audience: config.audience,
      tone: config.tone || 'professional',
      targetLength: config.targetLength || 'medium',
      categoryName: config.categoryName || 'Market Insights',
      keyPoints: [
        'Fully rewrite all source material into entirely original Navigate Wealth content — never reference or attribute original sources',
        'Preserve ALL numerical data precisely — percentages, rand values, dates, thresholds, limits — with absolutely no omissions',
        'South African investor perspective — interpret through SA tax law, SARS, Regulation 28, RAs, TFSAs, rand/offshore allocation, JSE',
        'Practical, actionable takeaways for Navigate Wealth clients',
        'How this affects long-term financial planning decisions',
      ],
      additionalInstructions: `Transform these recent financial news stories into an entirely original Navigate Wealth thought-leadership article. Never mention, cite, or attribute the original source publications in any way — no phrases such as "according to" or "a recent report." Preserve ALL numerical data (percentages, rand values, dates, thresholds, limits) precisely with absolutely no omissions or generalisations.\n\n${newsContext}\n\nThe article must read as entirely original Navigate Wealth content, not a news summary or paraphrase. Interpret all material through a South African financial planning lens — incorporate SARS implications, Regulation 28, RAs, TFSAs, rand exposure, and JSE dynamics where relevant. Conclude with a decisive strategic advisory takeaway that reinforces the value of working with a Navigate Wealth financial adviser.`,
      ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
    };

    const result = await generateFullArticle(brief, { excludeImageIds });

    if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

    const typeId = await getDefaultTypeId();
    const articleId = await createDraftArticle(
      result,
      config.categoryId || '',
      typeId,
      'news_commentary',
    );
    articleIds.push(articleId);

    // Mark all processed items
    for (const item of unprocessed) {
      const hash = simpleHash(item.title);
      await kv.set(processedKey('news_commentary', hash), {
        processedAt: new Date().toISOString(),
        articleId,
        sourceTitle: item.title,
      });
    }

    // Update source counters
    for (const src of sources) {
      await incrementSourceCounters(src, 1);
    }

    return {
      pipelineId: 'news_commentary',
      status: 'success',
      articlesGenerated: 1,
      articleIds,
      summary: `Generated news commentary: "${result.title}" (from ${unprocessed.length} source items)`,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('News commentary pipeline failed', err);
    return {
      pipelineId: 'news_commentary',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline 4: Calendar-Driven Content
// ---------------------------------------------------------------------------

/**
 * Default SA financial calendar events.
 * Seeded on first use; admins can add/remove via the UI.
 */
const DEFAULT_CALENDAR_EVENTS: Omit<CalendarEvent, 'id'>[] = [
  {
    name: 'Tax Season Opens',
    description: 'SARS tax filing season opens for individual taxpayers',
    month: 7,
    day: 1,
    recurring: true,
    leadTimeDays: 14,
    articleTopic: 'Tax Season Preparation Guide for South African Investors',
    keyPoints: [
      'Key dates and deadlines for the current tax year',
      'Tax-efficient investment strategies (RA contributions, TFSA)',
      'Common tax deductions financial advisors should remind clients about',
      'Section 11F retirement fund deductions',
      'Capital gains tax considerations for investment portfolios',
    ],
    isActive: true,
  },
  {
    name: 'National Budget Speech',
    description: 'Annual National Budget Speech by the Minister of Finance',
    month: 2,
    day: 19,
    recurring: true,
    leadTimeDays: 7,
    articleTopic:
      'What to Expect from the National Budget Speech: Key Areas for Financial Advisors',
    keyPoints: [
      'Expected changes to personal income tax brackets',
      'Potential adjustments to retirement fund contribution limits',
      'Capital gains tax and estate duty expectations',
      'Impact on the Rand and investment markets',
      'What clients should discuss with their financial advisor',
    ],
    isActive: true,
  },
  {
    name: 'Tax Year End',
    description: 'South African tax year ends on 28/29 February',
    month: 2,
    day: 28,
    recurring: true,
    leadTimeDays: 30,
    articleTopic: 'Year-End Tax Planning: Maximise Your Tax Benefits Before the Deadline',
    keyPoints: [
      'Retirement annuity top-up strategies before year-end',
      'Tax-free savings account (TFSA) contribution maximisation',
      'Charitable donation deductions (Section 18A)',
      'Medical scheme fee tax credits review',
      'Capital gains tax harvesting opportunities',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — January',
    description: 'SA Reserve Bank Monetary Policy Committee interest rate announcement',
    month: 1,
    day: 25,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'MPC Interest Rate Decision: What It Means for Your Financial Plan',
    keyPoints: [
      'Current inflation trends and their impact on interest rates',
      'How rate changes affect bond portfolios and property investments',
      'Impact on variable-rate home loans and credit',
      'What the decision signals about the economic outlook',
      'Strategies for investors in the current rate environment',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — March',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 3,
    day: 27,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'MPC Rate Decision: Navigating the Interest Rate Cycle',
    keyPoints: [
      'Rate decision context and economic indicators',
      'Impact on fixed income and money market investments',
      'Implications for clients with home loans',
      'How to position portfolios based on rate direction',
      'Guidance for clients concerned about rate changes',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — May',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 5,
    day: 22,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'Mid-Year Rate Decision: Interest Rate Outlook for SA Investors',
    keyPoints: [
      'Rate decision and its impact on investment strategy',
      'Fixed vs variable rate considerations',
      'Impact on retirement fund returns',
      'Global rate environment comparison',
      'Advisor talking points for client conversations',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — July',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 7,
    day: 17,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'July MPC Decision: Rates, Inflation, and Your Investment Strategy',
    keyPoints: [
      'Mid-year economic assessment',
      'Inflation trajectory and rate implications',
      'Portfolio positioning guidance',
      'Impact on income-generating investments',
      'Long-term planning considerations',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — September',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 9,
    day: 18,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'September MPC Rate Decision: Building Towards Year-End',
    keyPoints: [
      'Rate decision and Q3 economic outlook',
      'Year-end portfolio review considerations',
      'Impact on annual financial planning',
      'Client communication strategies',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — November',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 11,
    day: 20,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'Final MPC Decision of the Year: Setting Up for Success',
    keyPoints: [
      'Final rate decision and year-in-review',
      'How the rate cycle has evolved during the year',
      'Positioning for the new year',
      'Tax year-end planning in context of rates',
    ],
    isActive: true,
  },
  {
    name: 'Retirement Fund Contribution Deadline',
    description: 'Deadline for additional RA contributions to count against current tax year',
    month: 2,
    day: 28,
    recurring: true,
    leadTimeDays: 45,
    articleTopic: 'Retirement Annuity Contributions: Your Last Chance to Save Tax This Year',
    keyPoints: [
      'Maximum deductible RA contribution limits (27.5% of taxable income, capped at R350,000)',
      'Benefits of topping up before tax year-end',
      'How to calculate optimal contribution amounts',
      'Comparison of RA vs TFSA for tax-efficient savings',
      'Steps to arrange a top-up with your financial advisor',
    ],
    isActive: true,
  },
  {
    name: 'Medium-Term Budget Policy Statement',
    description: 'Finance Minister delivers the Medium-Term Budget Policy Statement',
    month: 10,
    day: 30,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'Medium-Term Budget: What the Revised Outlook Means for Your Finances',
    keyPoints: [
      'Key fiscal revisions and what they signal',
      'Impact on government bond yields and investor confidence',
      'Revenue collection performance and tax implications',
      'SOE funding and fiscal risk assessment',
      'What advisors should discuss with clients',
    ],
    isActive: true,
  },
  {
    name: 'Annual TFSA Contribution Reset',
    description: 'Tax-Free Savings Account annual contribution limit resets on 1 March',
    month: 3,
    day: 1,
    recurring: true,
    leadTimeDays: 14,
    articleTopic: 'New Tax Year, New TFSA Opportunity: Maximise Your R36,000 Allowance',
    keyPoints: [
      'Annual R36,000 and lifetime R500,000 contribution limits',
      'Benefits of contributing early in the tax year (compound growth)',
      'Choosing the right TFSA investment (ETFs, unit trusts, fixed deposits)',
      'TFSA vs RA comparison for different investor profiles',
      'Common TFSA mistakes to avoid',
    ],
    isActive: true,
  },
];

export async function seedCalendarEvents(): Promise<CalendarEvent[]> {
  const existing = await kv.getByPrefix(CALENDAR_PREFIX);
  if ((existing as CalendarEvent[]).length > 0) {
    log.info('Calendar events already seeded');
    return existing as CalendarEvent[];
  }

  const events: CalendarEvent[] = [];
  for (const def of DEFAULT_CALENDAR_EVENTS) {
    const id = crypto.randomUUID();
    const event: CalendarEvent = { id, ...def };
    await kv.set(calendarKey(id), event);
    events.push(event);
  }

  log.info(`Seeded ${events.length} default calendar events`);
  return events;
}

async function runCalendarContent(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];

  try {
    // Ensure calendar events exist
    const events = await seedCalendarEvents();
    const activeEvents = events.filter((e) => e.isActive);

    const now = new Date();
    const currentYear = now.getFullYear();
    const leadDays = config.leadTimeDays || 14;

    // Find events that are upcoming within the lead time
    const upcomingEvents: CalendarEvent[] = [];
    for (const event of activeEvents) {
      if (event.lastGeneratedYear === currentYear) continue;

      const eventDate = new Date(event.year || currentYear, event.month - 1, event.day);
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const effectiveLeadTime = event.leadTimeDays || leadDays;
      if (daysUntil >= 0 && daysUntil <= effectiveLeadTime) {
        upcomingEvents.push(event);
      }
    }

    if (upcomingEvents.length === 0) {
      return {
        pipelineId: 'calendar_content',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'No upcoming calendar events within the lead time window',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Auto-category + stale image prevention
    const categoryContext = !config.categoryId
      ? await getAvailableCategoryNames()
      : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    // Generate an article for each upcoming event
    for (const event of upcomingEvents) {
      try {
        // Cross-pipeline dedup
        if (await isTopicDuplicate(event.articleTopic, 'calendar_content')) {
          log.info('Skipping calendar event — topic already covered', { event: event.name });
          continue;
        }

        const eventDate = new Date(event.year || currentYear, event.month - 1, event.day);
        const eventDateStr = eventDate.toLocaleDateString('en-ZA', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        const brief: GenerateArticleBrief = {
          topic: event.articleTopic,
          audience: config.audience,
          tone: config.tone || 'educational',
          targetLength: config.targetLength || 'medium',
          categoryName: config.categoryName || 'Financial Planning',
          keyPoints: event.keyPoints,
          additionalInstructions: `This article is being generated ahead of "${event.name}" on ${eventDateStr}.\n\n${event.description}\n\nWrite a timely, forward-looking article that helps Navigate Wealth clients prepare for this event. Include ALL relevant numerical data — exact percentages, rand amounts, thresholds, contribution limits, tax brackets, and effective dates — with absolutely no omissions or generalisations. Interpret through a South African financial planning lens, incorporating SARS implications, Regulation 28, RAs, TFSAs, and relevant tax legislation. Conclude with a decisive strategic advisory takeaway that positions Navigate Wealth as the trusted partner for proactive financial planning.`,
          ...(categoryContext.names.length > 0
            ? { availableCategories: categoryContext.names }
            : {}),
        };

        const result = await generateFullArticle(brief, { excludeImageIds });

        if (result.unsplashPhotoId) {
          await recordUsedImage(result.unsplashPhotoId);
          excludeImageIds.add(result.unsplashPhotoId);
        }

        const typeId = await getDefaultTypeId();
        const articleId = await createDraftArticle(
          result,
          config.categoryId || '',
          typeId,
          'calendar_content',
        );
        articleIds.push(articleId);

        // Mark event as generated for this year
        const updated: CalendarEvent = { ...event, lastGeneratedYear: currentYear };
        await kv.set(calendarKey(event.id), updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        errors.push(`Failed for event "${event.name}": ${msg}`);
        log.error('Calendar content generation failed', { event: event.name, error: msg });
      }
    }

    return {
      pipelineId: 'calendar_content',
      status: articleIds.length > 0 ? (errors.length > 0 ? 'partial' : 'success') : 'error',
      articlesGenerated: articleIds.length,
      articleIds,
      summary:
        articleIds.length > 0
          ? `Generated ${articleIds.length} calendar-driven article(s) for: ${upcomingEvents
              .filter((_, i) => articleIds[i])
              .map((e) => e.name)
              .join(', ')}`
          : 'No articles generated',
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('Calendar content pipeline failed', err);
    return {
      pipelineId: 'calendar_content',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline Orchestrator
// ---------------------------------------------------------------------------

export const PIPELINE_RUNNERS: Record<
  PipelineId,
  (config: PipelineConfig) => Promise<PipelineTriggerResult>
> = {
  market_commentary: runMarketCommentary,
  regulatory_monitor: runRegulatoryMonitor,
  news_commentary: runNewsCommentary,
  calendar_content: runCalendarContent,
};
