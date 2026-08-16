/** Query param used by WebSite SearchAction sitelinks (`/resources?q=`). */
export const RESOURCES_SEARCH_PARAM = 'q';

export function readResourcesSearchQuery(searchParams: URLSearchParams): string {
  return (searchParams.get(RESOURCES_SEARCH_PARAM) ?? '').trim();
}

export function writeResourcesSearchQuery(prev: URLSearchParams, value: string): URLSearchParams {
  const next = new URLSearchParams(prev);
  const trimmed = value.trim();
  if (trimmed) next.set(RESOURCES_SEARCH_PARAM, trimmed);
  else next.delete(RESOURCES_SEARCH_PARAM);
  return next;
}
