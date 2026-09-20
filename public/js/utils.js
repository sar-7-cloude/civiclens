/* CivicLens – shared utilities: text similarity, stats, formatting, charts, toast */
window.CL = window.CL || {};

CL.utils = (function () {
  'use strict';

  const CATEGORIES = ['roads', 'streetlights', 'water', 'sanitation', 'drainage', 'encroachment', 'noise', 'other'];
  const STATUSES = ['open', 'in-progress', 'resolved'];
  const CAT_COLORS = {
    roads: '#c05621', streetlights: '#d69e2e', water: '#2b6cb0', sanitation: '#2f855a',
    drainage: '#6b46c1', encroachment: '#c53030', noise: '#dd6b20', other: '#718096'
  };

  /* ---------- text similarity (trigram Jaccard) ---------- */
  function trigrams(s) {
    s = (' ' + String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ');
    const set = new Set();
    for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3));
    return set;
  }
  function jaccard(a, b) {
    const A = trigrams(a), B = trigrams(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return inter / (A.size + B.size - inter);
  }

  /* ---------- normalisation ---------- */
  function normCategory(c) {
    const v = String(c || '').toLowerCase().trim();
    if (CATEGORIES.includes(v)) return v;
    if (/road|pothole|asphalt|speed.?break|patch/.test(v)) return 'roads';
    if (/street.?light|lamp|light ?post/.test(v)) return 'streetlights';
    if (/water|pipeline|tap|tanker|supply/.test(v)) return 'water';
    if (/garbage|sanit|waste|sweep|dustbin|trash/.test(v)) return 'sanitation';
    if (/drain|sewer|sewage|manhole|storm/.test(v)) return 'drainage';
    if (/encroach|footpath|hawk|illegal/.test(v)) return 'encroachment';
    if (/noise|sound|loud/.test(v)) return 'noise';
    return 'other';
  }
  function normStatus(s) {
    const v = String(s || '').toLowerCase().trim();
    if (/^open|^new|^pending$/.test(v)) return 'open';
    if (/progress|ongoing|assigned|wip/.test(v)) return 'in-progress';
    if (/resolv|closed|done|complete|fixed/.test(v)) return 'resolved';
    return 'open';
  }
  function toISODate(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/); // dd/mm/yyyy
    if (m) {
      const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
      return `${m[3]}-${mo}-${d}`;
    }
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  }

  /* ---------- dates & formatting ---------- */
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(aIso, bIso) {
    return Math.round((new Date(bIso) - new Date(aIso)) / 86400000);
  }
  const ESC_MAP = { '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' };
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => '&' + ESC_MAP[ch] + ';');
  }

  /* ---------- aggregation helpers (all take row arrays) ---------- */
  function countsBy(rows, key) {
    const out = {};
    rows.forEach((r) => { const k = r[key]; if (k != null) out[k] = (out[k] || 0) + 1; });
    return out;
  }
  function uniqueWards(rows) {
    return [...new Set(rows.map((r) => r.ward).filter(Boolean))].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10), nb = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }
  function refDate(rows) { // "as of" date = latest complaint date in the dataset
    let max = null;
    rows.forEach((r) => { if (r.date && (!max || r.date > max)) max = r.date; });
    return max || new Date().toISOString().slice(0, 10);
  }
  function inRange(r, from, to) {
    return (!from || r.date >= from) && (!to || r.date <= to);
  }
  function filterRows(rows, ward, from, to) {
    return rows.filter((r) =>
      (!ward || r.ward === ward) && inRange(r, from, to));
  }
  function weeklyTrend(rows) {
    // buckets aligned to weeks (7-day) ending at refDate
    const ref = new Date(refDate(rows) + 'T00:00:00');
    const weeks = {};
    rows.forEach((r) => {
      if (!r.date) return;
      const age = Math.floor((ref - new Date(r.date + 'T00:00:00')) / 86400000);
      const w = Math.floor(age / 7);
      weeks[w] = weeks[w] || { total: 0, resolved: 0 };
      weeks[w].total++;
      if (r.status === 'resolved') weeks[w].resolved++;
    });
    const maxW = Math.max(0, ...Object.keys(weeks).map(Number));
    const out = [];
    for (let w = Math.min(12, maxW); w >= 0; w--) {
      const endD = new Date(ref); endD.setDate(endD.getDate() - w * 7);
      const startD = new Date(ref); startD.setDate(startD.getDate() - w * 7 - 6);
      const b = weeks[w] || { total: 0, resolved: 0 };
      out.push({
        label: startD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        total: b.total, resolved: b.resolved
      });
    }
    return out;
  }
  function stackedByWard(rows) {
    const wards = uniqueWards(rows);
    return wards.map((w) => {
      const cat = countsBy(rows.filter((r) => r.ward === w), 'category');
      return { ward: w, cats: cat, total: rows.filter((r) => r.ward === w).length };
    });
  }
  function avgResolutionByCategory(rows) {
    const sums = {};
    rows.forEach((r) => {
      if (r.status === 'resolved' && r.date && r.resolvedDate) {
        const d = daysBetween(r.date, r.resolvedDate);
        if (d >= 0) {
          sums[r.category] = sums[r.category] || { sum: 0, n: 0 };
          sums[r.category].sum += d; sums[r.category].n++;
        }
      }
    });
    return Object.entries(sums).map(([cat, v]) => ({ cat, avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
  }
  // week-over-week spike per category (last 7 days of data vs previous 7)
  function detectSpikes(rows) {
    const ref = refDate(rows);
    const prevStart = addDays(ref, -13), curStart = addDays(ref, -6);
    const out = [];
    CATEGORIES.forEach((cat) => {
      const cur = rows.filter((r) => r.category === cat && r.date >= curStart).length;
      const prev = rows.filter((r) => r.category === cat && r.date >= prevStart && r.date < curStart).length;
      const pct = prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0);
      out.push({ category: cat, current: cur, previous: prev, pct: Math.round(pct) });
    });
    return out.sort((a, b) => b.pct - a.pct);
  }
  // ward-level anomalies: last 7 days vs average weekly rate of previous 28 days
  function detectAnomalies(rows) {
    const ref = refDate(rows);
    const curStart = addDays(ref, -6);
    const p28start = addDays(ref, -34), p7start = addDays(ref, -13);
    const out = [];
    uniqueWards(rows).forEach((w) => {
      CATEGORIES.forEach((cat) => {
        const inWard = (r) => r.ward === w && r.category === cat;
        const cur = rows.filter((r) => inWard(r) && r.date >= curStart).length;
        const prev = rows.filter((r) => inWard(r) && r.date >= p28start && r.date < p7start).length;
        if (cur < 3) return;
        const avgWeek = prev / 4;
        if (avgWeek < 0.5 ? cur >= 3 && prev === 0 : cur >= 1.25 * avgWeek) {
          out.push({
            ward: w, category: cat, current: cur,
            pct: avgWeek > 0 ? Math.round(((cur - avgWeek) / avgWeek) * 100) : 100
          });
        }
      });
    });
    return out.sort((a, b) => b.current - a.current);
  }
  function topUrgentOpen(rows, n) {
    return rows
      .filter((r) => r.urgency === 'high' && r.status !== 'resolved')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, n);
  }
  function overallStats(rows) {
    const total = rows.length;
    const st = countsBy(rows, 'status');
    const resolved = st.resolved || 0;
    return {
      total,
      open: (st.open || 0) + (st['in-progress'] || 0),
      resolved,
      rate: total ? Math.round((resolved / total) * 100) : 0
    };
  }

  /* ---------- AI data digest (for chat & summary prompts) ---------- */
  function buildDigest(rows) {
    if (!rows.length) return 'Dataset is empty (no rows loaded).';
    const ref = refDate(rows);
    const st = overallStats(rows);
    const cats = countsBy(rows, 'category');
    const wards = countsBy(rows, 'ward');
    const topWards = Object.entries(wards).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([w, c]) => `${w}: ${c}`).join(', ');
    const urg = countsBy(rows.filter((r) => r.status !== 'resolved'), 'urgency');
    const res = avgResolutionByCategory(rows).map((x) => `${x.cat}: ${x.avg.toFixed(1)}d (n=${x.n})`).join(', ');
    const spikes = detectSpikes(rows).filter((s) => s.pct > 25 && s.current >= 2)
      .map((s) => `${s.category}: ${s.previous}->${s.current} last 7d (${s.pct > 0 ? '+' : ''}${s.pct}%)`).join('; ');
    const urgentEx = topUrgentOpen(rows, 3).map((r) => `- [${r.ward}] ${r.text.slice(0, 90)}`).join('\n');
    return [
      `Data as of ${ref}. Total grievances: ${st.total} (open+in-progress: ${st.open}, resolved: ${st.resolved}, resolution rate: ${st.rate}%).`,
      `Categories: ${CATEGORIES.map((c) => `${c} ${cats[c] || 0}`).join(', ')}.`,
      `Busiest wards: ${topWards}.`,
      `Unresolved urgency mix: high ${urg.high || 0}, moderate ${urg.moderate || 0}, low ${urg.low || 0}.`,
      `Avg resolution days by category: ${res || 'no resolution data'}.`,
      `Week-over-week (last 7d vs prior 7d): ${spikes || 'no category above the 25% growth threshold'}.`,
      `Highest-urgency unresolved examples:\n${urgentEx || 'none'}`
    ].join('\n');
  }

  /* ---------- chart helper (destroys previous instance; CDN fallback) ---------- */
  const chartRegistry = {};
  function chart(canvasId, cfg) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    if (typeof Chart === 'undefined') {
      el.parentElement.innerHTML = '<p class="cdn-warn">Charts are unavailable because the Chart.js CDN could not load (you may be offline). All figures below still reflect your data.</p>';
      return;
    }
    if (chartRegistry[canvasId]) chartRegistry[canvasId].destroy();
    chartRegistry[canvasId] = new Chart(el, cfg);
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 3800);
  }

  /* ---------- CSV serialization ---------- */
  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  return {
    CATEGORIES, STATUSES, CAT_COLORS,
    trigrams, jaccard, normCategory, normStatus, toISODate,
    fmtDate, fmtDateTime, addDays, daysBetween, escapeHtml,
    countsBy, uniqueWards, refDate, inRange, filterRows,
    weeklyTrend, stackedByWard, avgResolutionByCategory,
    detectSpikes, detectAnomalies, topUrgentOpen, overallStats, buildDigest,
    chart, toast, csvEscape
  };
})();
