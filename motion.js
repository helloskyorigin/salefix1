// Lightweight reveal-once animation. No scroll listeners, no repeated playback.
(() => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;

  const seen = new Set();
  const selectors = [
    '.lf-hero-copy', '.lf-hero-art', '.lf-mobile-proof',
    '.lf-feature', '.lf-audit-card', '.lf-comparison-card',
    '.lf-explain-heading', '.lf-explain-step', '.lf-explain-note', '.lf-inside-heading', '.lf-inside-card',
    '.lf-publish-copy', '.lf-publish-browser', '.lf-price', '.lf-faq'
  ];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target;
      seen.add(element.dataset.sfRevealKey);
      element.classList.add('sf-visible');
      observer.unobserve(element);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

  function setup() {
    const landing = document.querySelector('.landing-page');
    if (!landing) return;
    const nodes = selectors.flatMap(selector => [...landing.querySelectorAll(selector)]);
    if (!nodes.length) return;
    document.documentElement.classList.add('sf-motion-ready');
    nodes.forEach((element, index) => {
      if (element.getClientRects().length === 0 || getComputedStyle(element).display === 'none') return;
      // DOM nodes may be recreated on SPA navigation; replay is still prevented.
      const key = selectors.find(selector => element.matches(selector)) + ':' +
        [...landing.querySelectorAll(selectors.find(selector => element.matches(selector)))].indexOf(element);
      element.dataset.sfRevealKey = key;
      element.classList.add('sf-once');
      element.style.setProperty('--sf-delay', `${Math.min(index % 4, 3) * 55}ms`);
      if (seen.has(key)) element.classList.add('sf-visible');
      else observer.observe(element);
    });
  }

  const app = document.querySelector('#app');
  if (app) new MutationObserver(setup).observe(app, { childList: true });
  setup();
})();