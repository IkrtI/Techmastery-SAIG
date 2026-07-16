// Matomo (KMITL insight) — bundled init instead of an inline <script> so the
// helmet CSP only needs to allow the insight.kmitl.ac.th origin.
const MATOMO_URL = 'https://insight.kmitl.ac.th/';
const SITE_ID = '19';

declare global {
  interface Window {
    _paq?: unknown[][];
  }
}

export function initMatomo(): void {
  if (!import.meta.env.PROD) return; // no localhost noise in the dashboard
  const _paq = (window._paq = window._paq || []);
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  _paq.push(['setTrackerUrl', MATOMO_URL + 'matomo.php']);
  _paq.push(['setSiteId', SITE_ID]);
  const g = document.createElement('script');
  g.async = true;
  g.src = MATOMO_URL + 'matomo.js';
  document.head.appendChild(g);
}

/** SPA route change → new pageview (the snippet alone only counts the first load). */
export function trackPageView(path: string): void {
  if (!import.meta.env.PROD || !window._paq) return;
  window._paq.push(['setCustomUrl', path]);
  window._paq.push(['setDocumentTitle', document.title]);
  window._paq.push(['trackPageView']);
}
