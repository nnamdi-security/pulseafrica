/* When the ticker may go live: once the document has finished streaming, and, on a page that
   brings server data (it renders <PageData>, which leaves a [data-page-data] marker), once that
   data has hydrated. A store for useSyncExternalStore. */

let pageHydrated = false;
let ready = false;
const listeners = new Set<() => void>();

function settle() {
  if (ready) return;
  ready = true;
  listeners.forEach((notify) => notify());
}

export function markPageHydrated() {
  pageHydrated = true;
  if (document.readyState === 'complete') settle();
}

export function isPageReady() {
  return ready;
}

export function subscribePageReady(notify: () => void) {
  listeners.add(notify);
  const onLoad = () => {
    // The whole document has arrived: either the page has no server data, or it has hydrated it
    if (pageHydrated || !document.querySelector('[data-page-data]')) settle();
  };
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
  return () => {
    listeners.delete(notify);
    window.removeEventListener('load', onLoad);
  };
}
