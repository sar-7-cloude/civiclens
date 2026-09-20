/* CivicLens - Duplicate and cluster detection (same ward + trigram Jaccard similarity) */
(function () {
  'use strict';
  const U = CL.utils;

  function find(parent, x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(parent, a, b) { const ra = find(parent, a), rb = find(parent, b); if (ra !== rb) parent[ra] = rb; }

  function scanClusters(thresholdPct) {
    const rows = CL.store.rows;
    const threshold = thresholdPct / 100;
    const byWard = {};
    rows.forEach((r, i) => { (byWard[r.ward] = byWard[r.ward] || []).push(i); });
    const parent = rows.map((_, i) => i);
    Object.values(byWard).forEach((idxs) => {
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < idxs.length; b++) {
          if (U.jaccard(rows[idxs[a]].text, rows[idxs[b]].text) >= threshold) {
            union(parent, idxs[a], idxs[b]);
          }
        }
      }
    });
    const groups = {};
    rows.forEach((_, i) => {
      const root = find(parent, i);
      groups[root] = groups[root] || [];
      groups[root].push(i);
    });
    return Object.values(groups).filter((g) => g.length >= 2)
      .map((g) => ({ members: g.slice().sort((a, b) => (rows[a].date < rows[b].date ? -1 : 1)) }))
      .sort((a, b) => b.members.length - a.members.length);
  }

  function currentThreshold() {
    return parseInt(document.getElementById('simThreshold').value, 10);
  }

  function renderResults(clusters) {
    const out = document.getElementById('dupResults');
    if (!clusters || !clusters.length) {
      out.innerHTML = '<article class="card"><p class="muted">No likely duplicates found at this threshold. ' +
        'Lower the similarity threshold to catch looser matches.</p></article>';
      return;
    }
    const rows = CL.store.rows;
    const dupeCount = clusters.reduce((s, c) => s + c.members.length, 0);
    out.innerHTML =
      '<article class="card"><h3>' + clusters.length + ' duplicate cluster' + (clusters.length === 1 ? '' : 's') +
      ' / ' + dupeCount + ' complaints involved</h3>' +
      '<p class="muted">The earliest complaint in each cluster is highlighted as the likely original. ' +
      'Merge or close duplicates only through your official grievance system. CivicLens only flags them.</p></article>' +
      clusters.map((c, ci) => {
        const lead = rows[c.members[0]];
        return '<article class="card dup-cluster"><h3>Cluster ' + (ci + 1) + ' / ' +
          U.escapeHtml(lead.ward) + '</h3>' +
          '<div class="dup-pair">' + c.members.map((idx, mi) => {
            const r = rows[idx];
            return '<div class="dup-item' + (mi === 0 ? ' dup-lead' : '') + '">' +
              (mi === 0 ? '<span class="sim-tag">likely original</span><br>' : '') +
              U.escapeHtml(r.text) +
              '<div class="urg-meta">' + U.escapeHtml(r.id) + ' / ' + U.fmtDate(r.date) + ' / ' +
              '<span class="badge st-' + r.status + '">' + r.status + '</span> ' +
              '<span class="badge ' + r.category + '">' + r.category + '</span></div></div>';
          }).join('') + '</div></article>';
      }).join('');
  }

  function render() {
    const slider = document.getElementById('simThreshold');
    slider.value = CL.store.getPref('dupeThreshold', 45);
    document.getElementById('simOut').textContent = slider.value + '%';
    if (CL.store.getPref('dupeScanned')) renderResults(scanClusters(currentThreshold()));
  }

  document.getElementById('simThreshold').addEventListener('input', (e) => {
    document.getElementById('simOut').textContent = e.target.value + '%';
    CL.store.setPref('dupeThreshold', parseInt(e.target.value, 10));
  });
  document.getElementById('btnScan').addEventListener('click', () => {
    CL.store.setPref('dupeScanned', true);
    renderResults(scanClusters(currentThreshold()));
  });

  if (window.CLApp) CLApp.register('duplicates', render);
})();
