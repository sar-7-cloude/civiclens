/* CivicLens – dataset store: loading, CSV parsing + validation, localStorage cache */
window.CL = window.CL || {};

CL.store = (function () {
  'use strict';
  const LS_DATA = 'civiclens.dataset.v1';
  const PREFS = 'civiclens.prefs.v1';
  const MAX_ROWS = 5000;
  const MAX_ERR_SHOWN = 50;

  let rows = [];
  let source = '';        // 'sample' | 'csv' | 'cache'
  let sourceName = '';    // file name or 'Built-in sample dataset'
  let loadedAt = null;    // ISO timestamp
  let lastLoadInfo = null; // { added, skipped, errors: [...] }
  const listeners = [];

  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } }); }
  function onChange(fn) { listeners.push(fn); }

  function normRow(r, i) {
    return {
      id: r.id || 'CL-' + String(i + 1).padStart(4, '0'),
      text: String(r.text || '').trim(),
      category: CL.utils.normCategory(r.category),
      ward: String(r.ward || '').trim() || 'Unspecified',
      date: CL.utils.toISODate(r.date) || new Date().toISOString().slice(0, 10),
      status: CL.utils.normStatus(r.status),
      resolvedDate: r.resolvedDate ? CL.utils.toISODate(r.resolvedDate) : null,
      urgency: ['low', 'moderate', 'high'].includes(r.urgency) ? r.urgency : 'low',
      sentiment: ['frustrated', 'neutral', 'informational'].includes(r.sentiment) ? r.sentiment : null
    };
  }

  /* ---------- sample dataset ---------- */
  async function loadSample() {
    const res = await fetch('data/sample-grievances.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load the sample dataset (HTTP ' + res.status + ').');
    const data = await res.json();
    rows = data.map(normRow);
    source = 'sample';
    sourceName = 'Built-in sample dataset';
    loadedAt = new Date().toISOString();
    lastLoadInfo = { added: rows.length, skipped: 0, errors: [] };
    saveCache();
    emit();
    return rows.length;
  }

  /* ---------- CSV parsing ---------- */
  function tokenize(text, delim) {
    const records = [];
    let field = '', record = [], inQ = false, i = 0;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === delim) { record.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { record.push(field); records.push(record); record = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || record.length) { record.push(field); records.push(record); }
    return records;
  }

  const COLS = {
    text: ['text', 'complaint', 'complainttext', 'complaint text', 'description', 'grievance', 'grievance text'],
    category: ['category', 'type', 'complaint type', 'complainttype'],
    ward: ['ward', 'ward no', 'wardno', 'ward number', 'zone'],
    date: ['date', 'filed on', 'filed date', 'fileddate', 'created', 'created date', 'createddate'],
    status: ['status'],
    resolvedDate: ['resolved date', 'resolveddate', 'closed date', 'closeddate'],
    urgency: ['urgency', 'priority'],
    sentiment: ['sentiment'],
    id: ['id', 'complaint id', 'complaintid']
  };

  function mapHeader(headerCells) {
    const map = {};
    headerCells.forEach((h, idx) => {
      const key = String(h || '').toLowerCase().trim().replace(/[_]+/g, ' ');
      for (const [field, aliases] of Object.entries(COLS)) {
        if (aliases.includes(key)) { if (!(field in map)) map[field] = idx; }
      }
    });
    return map;
  }

  function handleCSVText(text, fileName) {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const records = tokenize(text.replace(/^\uFEFF/, ''), delim);
    const errors = [];
    if (!records.length) return { ok: false, fatal: 'The CSV file appears to be empty.' };

    const map = mapHeader(records[0]);
    const missing = ['text', 'category', 'ward', 'date', 'status'].filter((f) => !(f in map));
    if (missing.length) {
      return {
        ok: false,
        fatal: 'Missing required column(s): ' + missing.join(', ') + '. Found header: "' +
          records[0].join(delim) + '". Please check the expected CSV format below.'
      };
    }

    const knownCats = CL.utils.CATEGORIES;
    const parsed = [];
    let skipped = 0;

    for (let i = 1; i < records.length; i++) {
      const rec = records[i];
      if (rec.length === 1 && String(rec[0]).trim() === '') continue; // blank line
      const rowNo = i + 1; // human row number incl. header
      const raw = {
        id: rec[map.id], text: rec[map.text], category: rec[map.category],
        ward: rec[map.ward], date: rec[map.date], status: rec[map.status],
        resolvedDate: map.resolvedDate !== undefined ? rec[map.resolvedDate] : '',
        urgency: map.urgency !== undefined ? rec[map.urgency] : '',
        sentiment: map.sentiment !== undefined ? rec[map.sentiment] : ''
      };
      let bad = false;

      if (!String(raw.text || '').trim()) { errors.push({ row: rowNo, msg: 'Empty complaint text — row skipped.' }); bad = true; }
      if (!String(raw.ward || '').trim()) { errors.push({ row: rowNo, msg: 'Empty ward — row skipped.' }); bad = true; }
      const isoDate = CL.utils.toISODate(raw.date);
      if (!isoDate) { errors.push({ row: rowNo, msg: 'Invalid date "' + raw.date + '" (use YYYY-MM-DD or DD/MM/YYYY) — row skipped.' }); bad = true; }
      if (String(raw.status || '').trim() && !/^(open|in.?progress|pending|new|ongoing|assigned|wip|resolv\w*|clos\w*|done|complete\w*|fixed)$/i.test(String(raw.status).trim())) {
        errors.push({ row: rowNo, msg: 'Unrecognized status "' + raw.status + '" — defaulted to "open".' });
      }
      if (!String(raw.category || '').trim()) {
        errors.push({ row: rowNo, msg: 'Empty category — set to "other" (use the AI Classify view to re-classify it).' });
      } else if (!knownCats.includes(String(raw.category).toLowerCase().trim())) {
        errors.push({ row: rowNo, msg: 'Unknown category "' + raw.category + '" — mapped automatically (please verify).' });
      }
      if (bad) { skipped++; continue; }

      const r = normRow({
        id: String(raw.id || '').trim() || undefined, text: raw.text, category: raw.category,
        ward: raw.ward, date: isoDate, status: raw.status || 'open',
        resolvedDate: raw.resolvedDate, urgency: raw.urgency, sentiment: raw.sentiment
      }, parsed.length);
      parsed.push(r);
      if (parsed.length >= MAX_ROWS) {
        errors.push({ row: rowNo, msg: 'Row limit of ' + MAX_ROWS + ' reached — remaining rows ignored.' });
        break;
      }
    }

    if (!parsed.length) {
      return { ok: false, fatal: 'No valid rows found. Fix the errors above and re-upload.', errors };
    }
    rows = parsed;
    source = 'csv';
    sourceName = fileName || 'Uploaded CSV';
    loadedAt = new Date().toISOString();
    lastLoadInfo = { added: parsed.length, skipped, errors: errors.slice(0, MAX_ERR_SHOWN), errorCount: errors.length };
    saveCache();
    emit();
    return { ok: true, added: parsed.length, skipped, errorCount: errors.length };
  }

  /* ---------- persistence ---------- */
  function saveCache() {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify({ rows, source, sourceName, loadedAt }));
    } catch (e) {
      CL.utils.toast('Could not cache the dataset in this browser (storage full?). Data still works for this session.', 'error');
    }
  }
  function restoreFromCache() {
    try {
      const raw = localStorage.getItem(LS_DATA);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.rows) || !obj.rows.length) return false;
      rows = obj.rows.map(normRow);
      source = 'cache';
      sourceName = obj.sourceName || 'Previously loaded dataset';
      loadedAt = obj.loadedAt;
      lastLoadInfo = null;
      emit();
      return true;
    } catch (_) { return false; }
  }
  function resetToSample() {
    localStorage.removeItem(LS_DATA);
    return loadSample();
  }

  function addRow(r) {
    const row = normRow(Object.assign({ status: 'open', date: new Date().toISOString().slice(0, 10) }, r), rows.length);
    rows.push(row);
    saveCache();
    emit();
    return row;
  }

  /* ---------- prefs ---------- */
  function getPref(key, dflt) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) || '{}');
      return key in p ? p[key] : dflt;
    } catch (_) { return dflt; }
  }
  function setPref(key, val) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) || '{}');
      p[key] = val;
      localStorage.setItem(PREFS, JSON.stringify(p));
    } catch (_) { /* non-fatal */ }
  }

  return {
    get rows() { return rows; },
    get source() { return source; },
    get sourceName() { return sourceName; },
    get loadedAt() { return loadedAt; },
    get lastLoadInfo() { return lastLoadInfo; },
    onChange, loadSample, handleCSVText, restoreFromCache, resetToSample, addRow,
    getPref, setPref
  };
})();
