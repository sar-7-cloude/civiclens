/* CivicLens – AI grievance classification view */
(function () {
  'use strict';
  const U = CL.utils;
  let lastText = '';

  function render() {
    const wardSel = document.getElementById('corrWard');
    const wards = U.uniqueWards(CL.store.rows);
    wardSel.innerHTML = wards.map((w) => '<option>' + U.escapeHtml(w) + '</option>').join('') +
      '<option value="new">+ Other ward…</option>';
    if (window.CLAI && !window.CLAI.aiEnabled) {
      document.getElementById('classifyStatus').textContent =
        'AI is not configured — add GEMINI_API_KEY to .env and restart the server.';
    } else {
      document.getElementById('classifyStatus').textContent = '';
    }
  }

  async function classify() {
    const text = document.getElementById('classifyText').value.trim();
    const statusEl = document.getElementById('classifyStatus');
    const btn = document.getElementById('btnClassify');
    if (!text) { U.toast('Please enter some complaint text first.', 'error'); return; }
    if (window.CLAI && !window.CLAI.aiEnabled) {
      statusEl.textContent = 'AI is not configured — add GEMINI_API_KEY to .env and restart the server.';
      return;
    }
    btn.disabled = true;
    statusEl.textContent = 'Classifying with ' + (window.CLAI ? window.CLAI.model : 'Gemini') + '…';
    document.getElementById('classifyResultCard').hidden = true;
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Classification failed.');
      lastText = text;
      showResult(data, text);
      statusEl.textContent = '';
    } catch (e) {
      statusEl.textContent = '';
      U.toast(e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function showResult(r, text) {
    document.getElementById('classifyResultCard').hidden = false;
    document.getElementById('classifyResult').innerHTML =
      '<p class="muted small">“' + U.escapeHtml(text) + '”</p>' +
      '<div class="classify-chips">' +
      chip('Category', r.category, r.category) +
      chip('Sentiment', r.sentiment, '') +
      chip('Urgency', r.urgency, 'urg-' + r.urgency) +
      '</div>' +
      '<div class="reasoning"><strong>Why:</strong> ' + U.escapeHtml(r.reasoning) + '</div>' +
      '<p class="muted small">AI output is indicative only — review and correct below before using it.</p>';
    document.getElementById('corrCategory').value = r.category;
    document.getElementById('corrSentiment').value = r.sentiment;
    document.getElementById('corrUrgency').value = r.urgency;
    document.getElementById('classifyResultCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function chip(label, value, badgeClass) {
    return '<span class="chip"><span class="muted small">' + label + ':</span> ' +
      (badgeClass ? '<span class="badge ' + badgeClass + '">' + value + '</span>' :
        '<strong>' + U.escapeHtml(value) + '</strong>') + '</span>';
  }

  function addToDataset() {
    if (!lastText) return;
    let ward = document.getElementById('corrWard').value;
    if (ward === 'new') {
      const w = prompt('Enter the ward name / number:');
      if (!w) return;
      ward = w.trim();
    }
    CL.store.addRow({
      text: lastText,
      category: document.getElementById('corrCategory').value,
      sentiment: document.getElementById('corrSentiment').value,
      urgency: document.getElementById('corrUrgency').value,
      ward, status: 'open'
    });
    document.getElementById('classifyText').value = '';
    lastText = '';
    document.getElementById('classifyResultCard').hidden = true;
    U.toast('Complaint added to the loaded dataset as an open grievance.');
  }

  document.getElementById('btnClassify').addEventListener('click', classify);
  document.getElementById('btnAddRow').addEventListener('click', addToDataset);
  if (window.CLApp) CLApp.register('classify', render);
})();
