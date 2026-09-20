/**
 * CivicLens - Smart City Grievance Analysis & Resolution Insights System
 * Express server.
 *
 * The ONLY job of this backend is to keep the Gemini API key server-side.
 * All analytics run in the browser on the local dataset; the browser sends
 * plain-text prompts here, and this server forwards them to the Gemini API.
 *
 * Educational project (1M1B / IBM SkillsBuild) - SDG 11 & SDG 16.
 * CivicLens is an analytics and awareness tool, NOT an official grievance portal.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

app.use(express.json({ limit: '512kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

/* ------------------------------------------------------------------ */
/* Simple in-memory rate limit to protect the free-tier key            */
/* ------------------------------------------------------------------ */
const REQ_WINDOW_MS = 60 * 1000;
const REQ_MAX = 30;
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < REQ_WINDOW_MS);
  if (arr.length >= REQ_MAX) {
    return res.status(429).json({
      error: 'Too many AI requests in the last minute. Please wait a moment and try again.'
    });
  }
  arr.push(now);
  hits.set(ip, arr);
  next();
}

/* ------------------------------------------------------------------ */
/* Gemini REST helper                                                  */
/* ------------------------------------------------------------------ */
async function callGemini({ system, user, maxTokens = 700 }) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    const err = new Error(
      'AI features are not configured. Add your GEMINI_API_KEY to the .env file (see .env.example) and restart the server.'
    );
    err.status = 503;
    throw err;
  }
  const url = `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let msg = `Gemini API error (HTTP ${res.status}).`;
    if (res.status === 404) {
      msg += ` The model "${GEMINI_MODEL}" is not available for this key. There is no model called "gemini-3.6-flash". Try GEMINI_MODEL=gemini-2.5-flash (or gemini-3.7-flash if available on your key) in your .env file.`;
    } else if (res.status === 429) {
      msg += ' Free-tier rate limit reached. Wait a minute and retry.';
    } else if (res.status === 401 || res.status === 403) {
      msg += ' Your GEMINI_API_KEY looks invalid or is not authorised. Check the .env file.';
    }
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  const text = ((data.candidates || [])[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  if (!text) {
    const err = new Error('Gemini returned an empty response. Please try again.');
    err.status = 502;
    throw err;
  }
  return text;
}

function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

const DISCLAIMER =
  'CivicLens is an analytics and awareness tool for educational purposes. ' +
  'Insights are indicative, not official. Always escalate grievances through your city\'s official channels.';

/* ------------------------------------------------------------------ */
/* System prompts                                                      */
/* ------------------------------------------------------------------ */
const CLASSIFY_SYSTEM = `You are the classification engine of CivicLens, an educational civic-analytics tool that helps sort citizen grievance texts for awareness purposes. You are NOT an official municipal system.
Classify the given complaint text and respond ONLY with a valid JSON object (no markdown fences, no extra text) with these keys:
- "category": exactly one of "roads", "streetlights", "water", "sanitation", "drainage", "encroachment", "noise", "other"
- "sentiment": exactly one of "frustrated", "neutral", "informational"
- "urgency": exactly one of "low", "moderate", "high". Use "high" ONLY for immediate safety/health risks, e.g. exposed live electrical wires, open manholes, sewage in drinking water, road collapse. Routine service failures are low or moderate.
- "reasoning": one short sentence (max 25 words) in plain language explaining your choice, so a human reviewer can verify it.`;

const INSIGHTS_SYSTEM = `You are the CivicLens Insights Assistant, part of an educational civic-analytics tool used by municipal staff, ward officers, civic volunteers and citizens. You help users UNDERSTAND aggregated grievance data.
STRICT RULES you must always follow:
1. Answer ONLY with data-grounded observations from the dataset context provided, plus general civic-awareness knowledge. If the data does not contain the answer, say so plainly.
2. NEVER give legal advice, departmental directives, or instructions that could be mistaken for official municipal action. You suggest, you never direct.
3. Never claim to be an official municipal system, and never imply your statements are official records.
4. ALWAYS end every answer with this exact line on its own: "Please verify details with the concerned municipal department."
5. Keep answers under 180 words, plain simple language, bullet points where helpful.
6. This tool is for awareness and education (UN SDG 11 & 16 context); recommend official channels (municipal helpline, ward office, official app) for actual escalation.`;

const SUMMARY_SYSTEM = `You are the CivicLens daily summary generator for an educational civic-analytics tool. Using ONLY the dataset context provided, produce a plain-language executive summary for the day.
Use exactly these three sections, each on its own line, with these exact headings:
TOP 3 ISSUES TO WATCH: list the three most important issues (prefer open, high-urgency or fast-growing ones) with one clause of justification each.
SPIKE ALERT: if the provided week-over-week figures show any category growing more than 25%, name it and the growth; otherwise write exactly "No category crossed the 25% week-over-week spike threshold."
CIVIC AWARENESS TIP: one practical, actionable tip for citizens on reporting issues correctly through official channels (e.g. report potholes with location and photos via the official app).
Never give legal or departmental directives. Keep the full summary under 220 words. End with this exact line: "Insights are indicative, generated by CivicLens for educational use. Please verify details with the concerned municipal department."`;

/* ------------------------------------------------------------------ */
/* API routes                                                          */
/* ------------------------------------------------------------------ */
app.get('/api/config', (req, res) => {
  res.json({
    aiEnabled: !!GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here',
    model: GEMINI_MODEL,
    disclaimer: DISCLAIMER
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: GEMINI_MODEL, aiEnabled: !!GEMINI_API_KEY });
});

app.post('/api/classify', rateLimit, async (req, res) => {
  try {
    const text = String((req.body || {}).text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ error: 'Field "text" is required.' });
    const raw = await callGemini({
      system: CLASSIFY_SYSTEM,
      user: `Complaint text to classify:\n"""${text}"""`,
      maxTokens: 400
    });
    const parsed = extractJSON(raw) || {};
    const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);
    res.json({
      category: oneOf(String(parsed.category || '').toLowerCase().trim(),
        ['roads', 'streetlights', 'water', 'sanitation', 'drainage', 'encroachment', 'noise', 'other'], 'other'),
      sentiment: oneOf(String(parsed.sentiment || '').toLowerCase().trim(),
        ['frustrated', 'neutral', 'informational'], 'neutral'),
      urgency: oneOf(String(parsed.urgency || '').toLowerCase().trim(),
        ['low', 'moderate', 'high'], 'low'),
      reasoning: String(parsed.reasoning || 'No reasoning returned.').slice(0, 300)
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Classification failed.' });
  }
});

app.post('/api/insights', rateLimit, async (req, res) => {
  try {
    const question = String((req.body || {}).question || '').trim().slice(0, 500);
    const context = String((req.body || {}).context || '').slice(0, 12000);
    if (!question) return res.status(400).json({ error: 'Field "question" is required.' });
    const user = `Aggregated grievance dataset context (may be partial or empty):\n${context || '(no dataset context provided)'}\n\nUser question: ${question}`;
    const answer = await callGemini({ system: INSIGHTS_SYSTEM, user, maxTokens: 700 });
    res.json({ answer });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Insights request failed.' });
  }
});

app.post('/api/summary', rateLimit, async (req, res) => {
  try {
    const context = String((req.body || {}).context || '').slice(0, 12000);
    if (!context) return res.status(400).json({ error: 'Field "context" is required.' });
    const user = `Today's aggregated grievance dataset context:\n${context}\n\nProduce the CivicLens daily executive summary following the required format exactly.`;
    const summary = await callGemini({ system: SUMMARY_SYSTEM, user, maxTokens: 700 });
    res.json({ summary });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Summary generation failed.' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Unknown API route.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`CivicLens server running at http://localhost:${PORT}`);
  console.log(`Gemini model: ${GEMINI_MODEL} | AI features: ${GEMINI_API_KEY ? 'ENABLED' : 'DISABLED (set GEMINI_API_KEY in .env)'}`);
});
