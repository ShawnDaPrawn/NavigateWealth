/**
 * LinksStates — the /links page while its links load, and when they cannot
 * be loaded, with the live page's wording.
 */
import { SITE_ORIGIN } from '../../utils/siteOrigin';
import { LinksIcon } from './LinksIcons';
import '../styles/links.css';

export function LinksLoading() {
  return (
    <section className="nwlk-state nwlk-center" aria-busy="true" aria-label="Links">
      <span className="nwlk-spinner">
        <LinksIcon name="loader" size={20} stroke="#0D1626" className="nwlk-spin" />
      </span>
      <p className="nwlk-loading" role="status">
        Loading links
      </p>
    </section>
  );
}

export function LinksUnavailable() {
  return (
    <section className="nwlk-state nwlk-center">
      <span className="nwlk-unavail-ic">
        <LinksIcon name="link" size={20} />
      </span>
      <h1 className="nw-h nwlk-unavail-t">Links unavailable</h1>
      <p className="nwlk-unavail-p">
        This page is currently unavailable. The main Navigate Wealth website is still available.
      </p>
      <a className="nw-btn nwlk-visit" href={SITE_ORIGIN}>
        Visit website <LinksIcon name="arrowUpRight" size={16} />
      </a>
    </section>
  );
}
