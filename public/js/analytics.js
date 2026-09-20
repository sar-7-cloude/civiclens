/* CivicLens - Ward and trend analytics view */
(function () {
  'use strict';
  const U = CL.utils;
  let bound = false;

  function wardOptions(sel, includeAll) {
    const wards = U.uniqueWards(CL.store.rows);
    sel.innerHTML = (includeAll ? '<option value="">All wards</option>' : '') +
      wards.map((w) => '<option>' + U.escapeHtml(w) + '</option>').join('');
  }

  function getFilters() {
    return {
      ward: document.getElementById('anaWard').value,
      from: document.getElementById('anaFrom').value,
      to: document.getElementById('anaTo').value
    };
  }

  function setDefaults() {
    const rows = CL.store.rows;
    const ref = U.refDate(rows);
    wardOptions(document.getElementById('anaWard'), true);
    const saved = {
      ward: CL.store.getPref('ana.ward', ''),
      from: CL.store.getPref('ana.from', U.addDays(ref, -89)),
      to: CL.store.getPref('ana.to', ref)
    };
    document.getElementById('anaWard').value = saved.ward;
    if (![...document.getElementById('anaWard').options].some((o) => o.value === saved.ward)) {
      document.getElementById('anaWard').value = '';
    }
    document.getElementById('anaFrom').value = saved.from;
    document.getElementById('anaTo').value = saved.to;
  }

  function applyFilters(persist) {
    const f = getFilters();
    if (persist) {
      CL.store.setPref('ana.ward', f.ward);
      CL.store.setPref('ana.from', f.from);
      CL.store.setPref('ana.to', f.to);
    }
    const rows = U.filterRows(CL.store.rows, f.ward, f.from, f.to);
    renderTrend(rows);
    renderStacked(rows, f.ward);
    renderResolution(rows);
    renderAnomalies(rows);
  }

  function renderTrend(rows) {
    const trend = U.weeklyTrend(rows);
    U.chart('chartTrend', {
      type: 'line',
      data: {
        labels: trend.map((t) => t.label),
        datasets: [
          { label: 'Total complaints', data: trend.map((t) => t.total), borderColor: '#1273b8', backgroundColor: 'rgba(18,115,184,0.12)', fill: true, tension: 0.3 },
          { label: 'Resolved', data: trend.map((t) => t.resolved), borderColor: '#1e9e6a', backgroundColor: 'transparent', tension: 0.3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  function renderStacked(rows, wardFilter) {
    // stacked chart ignores the ward filter so ward comparison stays visible
    const dateF = getFilters();
    const dateRows = U.filterRows(CL.store.rows, null, dateF.from, dateF.to);
    const stacks = U.stackedByWard(dateRows);
    const cats = U.CATEGORIES.filter((c) => dateRows.some((r) => r.category === c));
    U.chart('chartWardCat', {
      type: 'bar',
      data: {
        labels: stacks.map((s) => s.ward),
        datasets: cats.map((c) => ({
          label: c,
          data: stacks.map((s) => s.cats[c] || 0),
          backgroundColor: U.CAT_COLORS[c],
          stack: 'c'
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  function renderResolution(rows) {
    const res = U.avgResolutionByCategory(rows);
    document.getElementById('resNote').textContent = res.length
      ? 'Based on ' + res.reduce((s, x) => s + x.n, 0) + ' resolved complaints that have a resolution date.'
      : 'No resolution dates in this selection. Upload a CSV with a resolved-date column to see this.';
    U.chart('chartRes', {
      type: 'bar',
      data: {
        labels: res.map((x) => x.cat),
        datasets: [{
          label: 'Avg days to resolve',
          data: res.map((x) => +x.avg.toFixed(1)),
          backgroundColor: res.map((x) => U.CAT_COLORS[x.cat] || '#718096'),
          borderRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
  }

  function renderAnomalies(rows) {
    const anomalies = U.detectAnomalies(rows);
    const spikes = U.detectSpikes(rows).filter((s) => s.pct > 25 && s.current >= 2);
    const out = document.getElementById('anomalyOut');
    let html = '';
    if (spikes.length) {
      html += '<p><strong>City-level spikes (last 7 days vs prior 7 days):</strong></p>' +
        spikes.map((s) =>
          '<div class="anomaly-item">' + s.category + ': ' + s.previous + ' to ' + s.current +
          ' complaints (' + (s.pct > 0 ? '+' : '') + s.pct + '% week-over-week)</div>').join('');
    }
    if (anomalies.length) {
      html += '<p class="mt"><strong>Ward-level anomalies (last 7 days vs 4-week weekly average):</strong></p>' +
        anomalies.slice(0, 8).map((a) =>
          '<div class="anomaly-item">' + U.escapeHtml(a.ward) + ' / ' + a.category + ': ' + a.current +
          ' complaints in the last 7 days (vs ~' + (a.pct ? '+' + a.pct + '%' : 'baseline') + ' of the usual weekly rate)</div>').join('');
    }
    if (!html) html = '<p class="muted">No anomalies detected in this selection. No category crossed the spike thresholds.</p>';
    out.innerHTML = html;
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.getElementById('btnAnaApply').addEventListener('click', () => applyFilters(true));
    document.getElementById('btnAnaReset').addEventListener('click', () => {
      CL.store.setPref('ana.ward', '');
      const ref = U.refDate(CL.store.rows);
      document.getElementById('anaWard').value = '';
      document.getElementById('anaFrom').value = U.addDays(ref, -89);
      document.getElementById('anaTo').value = ref;
      applyFilters(true);
    });
    ['anaWard', 'anaFrom', 'anaTo'].forEach((id) =>
      document.getElementById(id).addEventListener('change', () => applyFilters(true)));
  }

  function render() {
    bind();
    setDefaults();
    applyFilters(false);
  }

  if (window.CLApp) CLApp.register('analytics', render);
})();
