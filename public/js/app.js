/* CivicLens – app shell: view registry, navigation, init, online/offline status */
window.CLApp = (function () {
  'use strict';
  const renderers = {};

  function register(id, fn) { renderers[id] = fn; }

  function show(viewId) {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      const active = b.dataset.view === viewId;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === 'view-' + viewId);
    });
    CL.store.setPref('lastView', viewId);
    if (renderers[viewId]) {
      try { renderers[viewId](); } catch (e) {
        console.error('View render failed for ' + viewId, e);
        CL.utils.toast('Something went wrong while drawing this view.', 'error');
      }
    }
    window.scrollTo(0, 0);
  }

  function refreshNetStatus() {
    const pill = document.getElementById('netStatus');
    const last = CL.store.loadedAt;
    if (navigator.onLine) {
      pill.textContent = 'Online';
      pill.className = 'net-pill';
      pill.title = '';
    } else {
      pill.textContent = 'Offline — cached data, updated ' +
        (last ? CL.utils.fmtDateTime(last) : 'unknown');
      pill.className = 'net-pill offline';
      pill.title = 'You are offline. The last loaded dataset and analytics are shown from cache.';
    }
  }

  async function init() {
    document.querySelectorAll('.tab-btn').forEach((b) =>
      b.addEventListener('click', () => show(b.dataset.view)));

    window.addEventListener('online', refreshNetStatus);
    window.addEventListener('offline', refreshNetStatus);

    // dataset: restore from cache, else fetch sample
    if (!CL.store.restoreFromCache()) {
      try {
        await CL.store.loadSample();
      } catch (e) {
        CL.utils.toast('Could not load the sample dataset: ' + e.message, 'error');
      }
    }
    CL.store.onChange(refreshNetStatus);

    // server config (AI availability)
    try {
      const res = await fetch('/api/config');
      if (res.ok) window.CLAI = await res.json();
    } catch (_) { window.CLAI = { aiEnabled: false, model: 'unavailable' }; }

    refreshNetStatus();
    const last = CL.store.getPref('lastView', 'dashboard');
    show(['dashboard', 'data', 'classify', 'duplicates', 'analytics', 'library', 'report'].includes(last) ? last : 'dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { register, show };
})();
