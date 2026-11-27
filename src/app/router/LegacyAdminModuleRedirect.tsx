import { Navigate, useLocation, useParams } from 'react-router';

/**
 * `/admin/<module>` → `/admin?module=<module>`, keeping any query string.
 *
 * Admin modules are addressed by `?module=`, never by a path segment, but
 * several server emails linked to `/admin/calendar`, `/admin/tasks`,
 * `/admin/clients` and `/admin/esign?envelope=…`, which fell through to the
 * 404 page (2026-11-27). The emails now build the right address; this keeps
 * the links already sitting in inboxes working.
 */
export function LegacyAdminModuleRedirect() {
  const { module } = useParams();
  const { search, hash } = useLocation();

  const next = new URLSearchParams(search);
  if (module) next.set('module', module);
  const query = next.toString();

  return <Navigate to={`/admin${query ? `?${query}` : ''}${hash}`} replace />;
}
