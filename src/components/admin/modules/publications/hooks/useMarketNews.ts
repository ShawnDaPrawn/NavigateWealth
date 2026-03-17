import { useQuery } from '@tanstack/react-query';
import { fetchRSSFeed } from '../api';
import { NewsData, NewsCategory } from '../types';

export const NEWS_KEYS = {
  all: ['market-news'] as const,
  feeds: () => [...NEWS_KEYS.all, 'feeds'] as const,
};

const FEEDS = {
  economicNews: 'https://www.investing.com/rss/news_14.rss',
  forexNews: 'https://www.investing.com/rss/news_1.rss',
  stockMarket: 'https://www.investing.com/rss/news_25.rss',
  investingIdeas: 'https://www.investing.com/rss/news_1065.rss'
};

export function useMarketNews(enabled: boolean = true) {
  return useQuery({
    queryKey: NEWS_KEYS.feeds(),
    queryFn: async (): Promise<NewsData> => {
      const results: NewsData = {
        economicNews: [],
        forexNews: [],
        stockMarket: [],
        investingIdeas: []
      };

      const promises = Object.entries(FEEDS).map(async ([key, url]) => {
        const data = await fetchRSSFeed(url);
        if (data && data.length > 0) {
          results[key as NewsCategory] = data;
        }
      });

      await Promise.all(promises);
      return results;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: false, // Already has refetchInterval — no need to re-fetch on every mount
    refetchInterval: (query) => {
        // Auto refresh every 5 minutes if there are subscribers
        return enabled ? 1000 * 60 * 5 : false; 
    }
  });
}