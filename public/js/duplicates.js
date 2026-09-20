/* CivicLens - Duplicate and cluster detection */
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
})();
