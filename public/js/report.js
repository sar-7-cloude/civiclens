/* CivicLens - Report and export: printable HTML report + CSV exports */
(function () {
  'use strict';
  const U = CL.utils;
  let bound = false;

  function wardOptions(sel) {
    const wards = U.uniqueWards(CL.store.rows);
    sel.innerHTML = '<option value="">All wards</option>' +
      wards.map((w) => '<option>' + U.escapeHtml(w) + '</option>').join('');
  }

  function getFilters() {
    return {
      ward: document.getElementById('repWard').value,
      from: document.getElementById('repFrom').value,
      to: document.getElementById('repTo').value
    };
  }

  function computeReport() {
    const f = getFilters();
    const rows = U.filterRows(CL.store.rows, f.ward, f.from, f.to);
    const st = U.overallStats(rows);
    const cats = Object.entries(U.countsBy(rows, 'category')).sort((a, b) => b[1] - a[1]);
    const wards = Object.entries(U.countsBy(rows, 'ward')).sort((a, b) => b[1] - a[1]);
    const urg = U.countsBy(rows, 'urgency');
    const spikes = U.detectSpikes(rows).filter((s) => s.pct > 25 && s.current >= 2);
    const res = U.avgResolutionByCategory(rows);
    let summary = null;
    try {
      const s = JSON.parse(localStorage.getItem('civiclens.summary.v1') || 'null');
      if (s && s.date === new Date().toISOString().slice(0, 10)) summary = s;
    } catch (_) { /* noop */ }
    return { f, rows, st, cats, wards, urg, spikes, res, summary };
  }

  function renderPreview() {
    const r = computeReport();
    document.getElementById('reportPreview').innerHTML =
      '<p><strong>Selection:</strong> ' + (r.f.ward || 'All wards') + ' / ' +
      (r.f.from ? U.fmtDate(r.f.from) : 'start') + ' to ' + (r.f.to ? U.fmtDate(r.f.to) : 'latest') + '</p>' +
      '<p><strong>Overview:</strong> ' + r.st.total + ' grievances / ' + r.st.open + ' open+in-progress / ' +
      r.st.resolved + ' resolved (' + r.st.rate + '% resolution rate)</p>' +
      '<p><strong>Top categories:</strong> ' + (r.cats.slice(0, 4).map((c) => c[0] + ' (' + c[1] + ')').join(', ') || 'none') + '</p>' +
      '<p><strong>Top wards:</strong> ' + (r.wards.slice(0, 4).map((w) => w[0] + ' (' + w[1] + ')').join(', ') || 'none') + '</p>' +
      '<p><strong>Spikes:</strong> ' + (r.spikes.length ? r.spikes.map((s) => s.category + ' +' + s.pct + '%').join(', ') : 'none above 25%') + '</p>' +
      '<p><strong>AI daily summary:</strong> ' + (r.summary ? 'included (generated today)' : 'not generated today - use the Dashboard button first') + '</p>' +
      '<p class="muted small">"Open printable report" creates a clean, print/share-ready page with full tables. Use your browser print dialog to save as PDF.</p>';
  }

  function reportHtml(r) {
    const now = new Date();
    const table = (head, bodyRows) =>
      '<table><thead><tr>' + head.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      bodyRows.map((c) => '<tr>' + c.map((x) => '<td>' + U.escapeHtml(x) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<title>CivicLens Summary Report</title><style>' +
      'body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#16283a;margin:2rem;max-width:820px;line-height:1.5}' +
      'h1{color:#0a3d62;margin-bottom:0}h2{color:#0f5aa5;border-bottom:2px solid #e3eef7;padding-bottom:4px;margin-top:1.6rem}' +
      'table{width:100%;border-collapse:collapse;font-size:0.9rem;margin:0.6rem 0}' +
      'th,td{border:1px solid #d9e2ea;padding:6px 9px;text-align:left}th{background:#e3eef7}' +
      '.disclaimer{background:#fff7e0;border:1px solid #eadfa8;color:#6b4b00;padding:10px 14px;border-radius:8px;font-size:0.85rem;margin:1rem 0}' +
      '.meta{color:#5a6b7a;font-size:0.85rem}.sum{white-space:pre-wrap;background:#f4f7f9;border-radius:8px;padding:12px 16px;font-size:0.92rem}' +
      '.foot{margin-top:2rem;font-size:0.78rem;color:#5a6b7a;border-top:1px solid #d9e2ea;padding-top:10px}' +
      '@media print{body{margin:0}}' +
      '</style></head><body>' +
      '<h1>CivicLens - Grievance Analytics Summary Report</h1>' +
      '<p class="meta">Generated ' + U.fmtDateTime(now.toISOString()) + ' / Source: ' + U.escapeHtml(CL.store.sourceName || 'none') +
      ' / Selection: ' + (r.f.ward || 'All wards') + ', ' +
      (r.f.from ? U.fmtDate(r.f.from) : 'earliest') + ' to ' + (r.f.to ? U.fmtDate(r.f.to) : 'latest') + '</p>' +
      '<div class="disclaimer"><strong>CivicLens is an analytics and awareness tool for educational purposes.</strong> ' +
      'Insights are indicative, not official. Always escalate grievances through your city official channels.</div>' +
      '<h2>1. Overview</h2>' +
      table(['Total', 'Open / in-progress', 'Resolved', 'Resolution rate'],
        [[r.st.total, r.st.open, r.st.resolved, r.st.rate + '%']]) +
      '<h2>2. Category-wise breakdown</h2>' +
      table(['Category', 'Complaints', 'Share'],
        r.cats.map(([c, n]) => [c, n, (r.st.total ? Math.round((n / r.st.total) * 100) : 0) + '%'])) +
      '<h2>3. Ward ranking</h2>' +
      table(['Rank', 'Ward', 'Complaints'],
        r.wards.map(([w, n], i) => [i + 1, w, n])) +
      '<h2>4. Urgency distribution</h2>' +
      table(['Urgency', 'Complaints'],
        [['high', r.urg.high || 0], ['moderate', r.urg.moderate || 0], ['low', r.urg.low || 0]]) +
      '<h2>5. Average resolution time per category</h2>' +
      (r.res.length ? table(['Category', 'Avg days', 'Resolved count'],
        r.res.map((x) => [x.cat, x.avg.toFixed(1), x.n]))
        : '<p class="meta">No resolution-date data in this selection.</p>') +
      '<h2>6. Spike alerts (week-over-week, >25%)</h2>' +
      (r.spikes.length
        ? '<ul>' + r.spikes.map((s) => '<li>' + U.escapeHtml(s.category) + ': ' + s.previous + ' to ' +
            s.current + ' (' + (s.pct > 0 ? '+' : '') + s.pct + '%)</li>').join('') + '</ul>'
        : '<p class="meta">No category crossed the 25% week-over-week spike threshold.</p>') +
      '<h2>7. AI daily summary</h2>' +
      (r.summary
        ? '<div class="sum">' + U.escapeHtml(r.summary.text) + '</div>' +
          '<p class="meta">Generated ' + U.fmtDateTime(r.summary.at) + ' with ' + U.escapeHtml((window.CLAI || {}).model || 'Gemini') + '. AI output is indicative only.</p>'
        : '<p class="meta">Not generated today. Open the Dashboard and click "Generate today summary", then rebuild this report.</p>') +
      '<div class="foot">Student sustainability project / 1M1B / IBM SkillsBuild / UN SDG 11 (Sustainable Cities and Communities) and SDG 16 (Peace, Justice and Strong Institutions). ' +
      'This report is automatically generated from the loaded dataset and is not an official municipal record.</div>' +
      '</body></html>';
  }

  function printReport() {
    const r = computeReport();
    if (!r.rows.length) { U.toast('No grievances in the selected range.', 'error'); return; }
    const w = window.open('', '_blank');
    if (!w) { U.toast('Pop-up blocked - allow pop-ups for this page to open the report.', 'error'); return; }
    w.document.write(reportHtml(r));
    w.document.close();
    CL.utils.toast('Report opened in a new tab - use Print to save as PDF.');
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportAnalytics() {
    const r = computeReport();
    if (!r.rows.length) { U.toast('No grievances in the selected range.', 'error'); return; }
    const lines = [];
    lines.push('CivicLens Analytics Export');
    lines.push('Generated,' + new Date().toISOString());
    lines.push('Selection,' + (r.f.ward || 'All wards') + ',' + (r.f.from || '') + ',' + (r.f.to || ''));
    lines.push('');
    lines.push('SECTION,CATEGORY/WARD/URGENCY,COUNT,SHARE_OR_DETAIL');
    r.cats.forEach(([c, n]) => lines.push(['category', c, n, (r.st.total ? Math.round((n / r.st.total) * 100) : 0) + '%'].join(',')));
    r.wards.forEach(([wd, n], i) => lines.push(['ward-rank', wd, n, 'rank ' + (i + 1)].join(',')));
    lines.push(['urgency', 'high', r.urg.high || 0, ''].join(','));
    lines.push(['urgency', 'moderate', r.urg.moderate || 0, ''].join(','));
    lines.push(['urgency', 'low', r.urg.low || 0, ''].join(','));
    r.spikes.forEach((s) => lines.push(['spike', s.category, s.current, '+' + s.pct + '% vs prior week'].join(',')));
    r.res.forEach((x) => lines.push(['avg-resolution-days', x.cat, x.avg.toFixed(1), 'n=' + x.n].join(',')));
    lines.push(['overview', 'total', r.st.total, ''].join(','));
    lines.push(['overview', 'open', r.st.open, ''].join(','));
    lines.push(['overview', 'resolved', r.st.resolved, ''].join(','));
    lines.push(['overview', 'resolution-rate', r.st.rate + '%', ''].join(','));
    if (r.summary) lines.push(['ai-summary', new Date().toISOString().slice(0, 10), '', '"' + r.summary.text.replace(/"/g, '""').replace(/\n/g, ' ') + '"']);
    downloadFile('civiclens-analytics-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'));
    U.toast('Analytics CSV downloaded.');
  }

  function exportRows() {
    const r = computeReport();
    if (!r.rows.length) { U.toast('No grievances in the selected range.', 'error'); return; }
    const head = ['id', 'complaint text', 'category', 'ward', 'date', 'status', 'resolved date', 'urgency', 'sentiment'];
    const lines = [head.join(',')].concat(r.rows.map((x) =>
      [x.id, x.text, x.category, x.ward, x.date, x.status, x.resolvedDate || '', x.urgency, x.sentiment || '']
        .map((v) => U.csvEscape(v)).join(',')));
    downloadFile('civiclens-grievances-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'));
    U.toast('Grievances CSV downloaded (' + r.rows.length + ' rows).');
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.getElementById('btnPrintReport').addEventListener('click', printReport);
    document.getElementById('btnExportAnalytics').addEventListener('click', exportAnalytics);
    document.getElementById('btnExportRows').addEventListener('click', exportRows);
    ['repWard', 'repFrom', 'repTo'].forEach((id) =>
      document.getElementById(id).addEventListener('change', renderPreview));
  }

  function render() {
    bind();
    wardOptions(document.getElementById('repWard'));
    const ref = U.refDate(CL.store.rows);
    if (!CL.store.getPref('rep.init', false)) {
      document.getElementById('repFrom').value = U.addDays(ref, -89);
      document.getElementById('repTo').value = ref;
      CL.store.setPref('rep.init', true);
    }
    renderPreview();
  }

  if (window.CLApp) CLApp.register('report', render);
})();
