/* CivicLens – Dashboard view */
(function () {
  'use strict';
  const U = CL.utils;

  function render() {
    const rows = CL.store.rows;
    const st = U.overallStats(rows);
    document.getElementById('dashMeta').textContent =
      'Source: ' + (CL.store.sourceName || '—') + ' · Last updated: ' +
      (CL.store.loadedAt ? U.fmtDateTime(CL.store.loadedAt) : '—');

    /* KPI cards */
    document.getElementById('kpiGrid').innerHTML = [
      kpi(st.total, 'Total grievances', ''),
      kpi((U.countsBy(rows, 'status').open || 0), 'Open', 'k-open'),
      kpi((U.countsBy(rows, 'status')['in-progress'] || 0), 'In progress', 'k-open'),
      kpi(st.resolved, 'Resolved', 'k-resolved'),
      kpi(st.rate + '%', 'Resolution rate', 'k-rate')
    ].join('');

    /* charts */
    const catCounts = U.countsBy(rows, 'category');
    U.chart('chartCategory', {
      type: 'bar',
      data: {
        labels: Object.keys(catCounts),
        datasets: [{
          label: 'Complaints',
          data: Object.values(catCounts),
          backgroundColor: Object.keys(catCounts).map((c) => U.CAT_COLORS[c] || '#718096'),
          borderRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
    const stC = U.countsBy(rows, 'status');
    U.chart('chartStatus', {
      type: 'doughnut',
      data: {
        labels: ['Open', 'In progress', 'Resolved'],
        datasets: [{
          data: [stC.open || 0, stC['in-progress'] || 0, stC.resolved || 0],
          backgroundColor: ['#d69e2e', '#1273b8', '#1e9e6a']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '58%' }
    });

    /* urgency banner */
    const urgent = U.topUrgentOpen(rows, 3);
    const urgentCount = rows.filter((r) => r.urgency === 'high' && r.status !== 'resolved').length;
    const banner = document.getElementById('urgencyBanner');
    if (!urgentCount) {
      banner.innerHTML = '<h3>Urgency watch</h3><p class="muted">No high-urgency open issues in the current dataset.</p>';
    } else {
      banner.innerHTML =
        '<h3>Urgency watch: ' + urgentCount + ' critical open issue' + (urgentCount > 1 ? 's' : '') + '</h3>' +
        urgent.map((r) =>
          '<div class="urg-item"><strong>' + U.escapeHtml(r.ward) + '</strong> · ' + U.fmtDate(r.date) +
          ' — ' + U.escapeHtml(r.text) + '<div class="urg-meta">' + U.escapeHtml(r.id) + ' · escalate via official channels</div></div>'
        ).join('');
    }

    /* top wards */
    const wards = Object.entries(U.countsBy(rows, 'ward')).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = wards.length ? wards[0][1] : 1;
    document.getElementById('topWards').innerHTML = wards.map(([w, c]) =>
      '<li class="ward-row"><div class="row-top"><span>' + U.escapeHtml(w) + '</span><span>' + c + '</span></div>' +
      '<div class="ward-bar"><span style="width:' + Math.round((c / max) * 100) + '%"></span></div></li>'
    ).join('') || '<li class="muted">No data</li>';

    /* recent activity */
    const recent = rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
    document.getElementById('recentActivity').innerHTML = recent.map((r) =>
      '<li><span class="badge ' + r.category + '">' + r.category + '</span> ' +
      '<span class="badge st-' + r.status + '">' + r.status + '</span><br>' +
      U.escapeHtml(r.text.length > 110 ? r.text.slice(0, 110) + '…' : r.text) +
      '<div class="meta">' + U.escapeHtml(r.ward) + ' · ' + U.fmtDate(r.date) + ' · ' + U.escapeHtml(r.id) + '</div></li>'
    ).join('') || '<li class="muted">No data</li>';

    renderSummaryCard();
  }

  function kpi(num, label, cls) {
    return '<div class="kpi ' + cls + '"><div class="num">' + num + '</div><div class="lbl">' + label + '</div></div>';
  }

  /* ---------- AI daily summary (cached per day) ---------- */
  function renderSummaryCard() {
    const out = document.getElementById('summaryOut');
    const cached = readSummary();
    if (cached) {
      out.innerHTML = '<p class="muted small">Generated today at ' + U.fmtDateTime(cached.at) + ' · model: ' + (window.CLAI ? window.CLAI.model : 'AI') + '</p>' + prettySummary(cached.text);
    } else {
      out.innerHTML = '<p class="muted">Generate an executive summary: top 3 issues to watch, spike alerts and a civic-awareness tip. Uses the Gemini API (needs internet).</p>';
    }
  }
  function readSummary() {
    try {
      const s = JSON.parse(localStorage.getItem('civiclens.summary.v1') || 'null');
      if (s && s.date === new Date().toISOString().slice(0, 10)) return s;
    } catch (_) { /* noop */ }
    return null;
  }
  function prettySummary(text) {
    return '<div class="summary-out">' + U.escapeHtml(text)
      .replace(/^(TOP 3 ISSUES TO WATCH:|SPIKE ALERT:|CIVIC AWARENESS TIP:)/gm, '<span class="sum-head">$1</span>') + '</div>';
  }

  async function generateSummary() {
    const btn = document.getElementById('btnSummary');
    const out = document.getElementById('summaryOut');
    if (window.CLAI && !window.CLAI.aiEnabled) {
      out.innerHTML = '<p class="muted">AI features are disabled — add your GEMINI_API_KEY to the .env file and restart the server (see README).</p>';
      return;
    }
    btn.disabled = true;
    out.innerHTML = '<p class="muted">Generating summary…</p>';
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: U.buildDigest(CL.store.rows) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summary failed.');
      localStorage.setItem('civiclens.summary.v1', JSON.stringify({
        date: new Date().toISOString().slice(0, 10), at: new Date().toISOString(), text: data.summary
      }));
      renderSummaryCard();
      CL.utils.toast('Daily summary generated.');
    } catch (e) {
      out.innerHTML = '<p class="muted" style="color:var(--danger)">' + CL.utils.escapeHtml(e.message) + '</p>';
    } finally {
      btn.disabled = false;
    }
  }

  document.getElementById('btnSummary').addEventListener('click', generateSummary);

  if (window.CLApp) CLApp.register('dashboard', render);
})();
