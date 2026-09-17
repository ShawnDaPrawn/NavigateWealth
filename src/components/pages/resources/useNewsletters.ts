import { useQuery } from '@tanstack/react-query';
import { publicNewsletterKeys } from '../../../utils/queryKeys';
import { fetchPublishedNewsletter, fetchPublishedNewsletters } from './newsletterApi';

/** Published newsletters for the Resources tab. Fetched only while the tab is open. */
export function usePublishedNewsletters(enabled = true) {
  return useQuery({
    queryKey: publicNewsletterKeys.list(),
    queryFn: fetchPublishedNewsletters,
    enabled,
    // A newsletter appears once a month; there is nothing to gain from
    // re-fetching it on every mount.
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

/** One newsletter, for its own page. */
export function usePublishedNewsletter(slug: string | undefined) {
  return useQuery({
    queryKey: publicNewsletterKeys.detail(slug ?? ''),
    queryFn: () => fetchPublishedNewsletter(slug!),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}
