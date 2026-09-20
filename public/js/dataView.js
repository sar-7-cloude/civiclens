/* CivicLens – Data setup view: load sample / upload CSV / reset */
(function () {
  'use strict';
  const U = CL.utils;

  function render() {
    renderMeta();
    renderErrors();
    renderPreview();
  }

  function renderMeta() {
    const info = CL.store.lastLoadInfo;
    let txt = 'Current source: <strong>' + U.escapeHtml(CL.store.sourceName || 'none') + '</strong> · ' +
      CL.store.rows.length + ' grievance' + (CL.store.rows.length === 1 ? '' : 's') +
      ' · loaded ' + (CL.store.loadedAt ? U.fmtDateTime(CL.store.loadedAt) : '—');
    if (info && info.skipped) txt += ' · ' + info.skipped + ' invalid row' + (info.skipped === 1 ? '' : 's') + ' skipped';
    document.getElementById('dataMeta').innerHTML = txt;
  }

  function renderErrors() {
    const card = document.getElementById('csvErrorsCard');
    const info = CL.store.lastLoadInfo;
    if (!info || (!info.errors.length && !info.errorCount)) { card.hidden = true; return; }
    card.hidden = false;
    const list = info.errors.map((e) =>
      '<li><strong>Row ' + e.row + ':</strong> ' + U.escapeHtml(e.msg) + '</li>').join('');
    document.getElementById('csvErrors').innerHTML =
      '<p>' + info.added + ' rows loaded, ' + info.skipped + ' skipped' +
      (info.errorCount > info.errors.length ? ' (' + info.errorCount + ' issues total, showing first ' + info.errors.length + ')' : '') + '.</p>' +
      (info.errors.length ? '<ul class="err-list">' + list + '</ul>' : '<p class="err-ok">No validation issues.</p>');
  }

  function renderPreview() {
    const rows = CL.store.rows;
    const show = rows.slice(0, 25);
    document.getElementById('dataPreview').innerHTML = show.map((r) =>
      '<tr><td>' + U.escapeHtml(r.id) + '</td><td>' + U.escapeHtml(r.text) + '</td>' +
      '<td><span class="badge ' + r.category + '">' + r.category + '</span></td>' +
      '<td>' + U.escapeHtml(r.ward) + '</td><td>' + U.fmtDate(r.date) + '</td>' +
      '<td><span class="badge st-' + r.status + '">' + r.status + '</span></td>' +
      '<td><span class="badge urg-' + r.urgency + '">' + r.urgency + '</span></td></tr>'
    ).join('') || '<tr><td colspan="7" class="muted">No rows loaded.</td></tr>';
    document.getElementById('dataPreviewNote').textContent =
      rows.length > 25 ? 'Showing first 25 of ' + rows.length + ' rows.' : '';
  }

  document.getElementById('btnLoadSample').addEventListener('click', async () => {
    try {
      const n = await CL.store.loadSample();
      U.toast('Loaded ' + n + ' sample grievances.');
      render();
    } catch (e) { U.toast(e.message, 'error'); }
  });

  document.getElementById('csvFile').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { U.toast('File too large (max 5 MB).', 'error'); ev.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = CL.store.handleCSVText(String(reader.result), file.name);
      if (!result.ok) {
        U.toast(result.fatal || 'CSV could not be parsed.', 'error');
        if (result.errors && result.errors.length) {
          const card = document.getElementById('csvErrorsCard');
          card.hidden = false;
          document.getElementById('csvErrors').innerHTML =
            '<p style="color:var(--danger)">' + U.escapeHtml(result.fatal) + '</p>' +
            '<ul class="err-list">' + result.errors.slice(0, 50).map((e) =>
              '<li><strong>Row ' + e.row + ':</strong> ' + U.escapeHtml(e.msg) + '</li>').join('') + '</ul>';
        }
      } else {
        U.toast('Loaded ' + result.added + ' rows from ' + file.name +
          (result.skipped ? ' (' + result.skipped + ' skipped — see validation report)' : '.'));
        render();
      }
      ev.target.value = '';
    };
    reader.onerror = () => U.toast('Could not read the file.', 'error');
    reader.readAsText(file);
  });

  document.getElementById('btnReset').addEventListener('click', async () => {
    try {
      localStorage.removeItem('civiclens.summary.v1');
      await CL.store.resetToSample();
      U.toast('Reset to sample data.');
      render();
    } catch (e) { U.toast(e.message, 'error'); }
  });

  if (window.CLApp) CLApp.register('data', render);
})();
