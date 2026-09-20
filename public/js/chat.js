/* CivicLens – AI insights assistant (floating chat widget) */
(function () {
  'use strict';
  const U = CL.utils;
  const history = []; // short memory of the conversation
  const VERIFY_NOTE = 'Please verify details with the concerned municipal department.';

  const toggleBtn = document.getElementById('chatToggle');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const msgs = document.getElementById('chatMessages');

  function isOpen() { return !panel.hidden; }
  function setOpen(open) {
    panel.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  }
  toggleBtn.addEventListener('click', () => {
    if (!isOpen() && !msgs.childElementCount) greet();
    setOpen(!isOpen());
  });
  closeBtn.addEventListener('click', () => setOpen(false));

  function greet() {
    addMsg('bot', 'Hi! I can help you explore the loaded grievance data — patterns, spikes, wards, urgency. ' +
      'I give awareness information only, never official directives. ' + VERIFY_NOTE);
  }

  function addMsg(role, text, isNote) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    if (role === 'bot' && !isNote) {
      const note = document.createElement('span');
      note.className = 'verify-note';
      note.textContent = VERIFY_NOTE;
      div.appendChild(note);
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function send(ev) {
    ev.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    if (window.CLAI && !window.CLAI.aiEnabled) {
      U.toast('AI is not configured — add GEMINI_API_KEY to .env and restart the server.', 'error');
      return;
    }
    input.value = '';
    addMsg('user', q);
    const thinking = document.createElement('div');
    thinking.className = 'chat-msg bot';
    thinking.textContent = 'Thinking…';
    msgs.appendChild(thinking);
    msgs.scrollTop = msgs.scrollHeight;
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          context: U.buildDigest(CL.store.rows)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The request failed.');
      thinking.remove();
      addMsg('bot', data.answer);
      history.push({ q, a: data.answer });
      if (history.length > 6) history.shift();
    } catch (e) {
      thinking.remove();
      addMsg('bot', 'Sorry, something went wrong: ' + e.message, true);
    }
  }
  form.addEventListener('submit', send);
})();
