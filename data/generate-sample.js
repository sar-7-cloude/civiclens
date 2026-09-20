#!/usr/bin/env node
/**
 * CivicLens sample dataset generator.
 * Generates a deterministic synthetic dataset of municipal grievances
 * (170+ rows) including duplicate reports and a deliberate drainage spike
 * in Ward 7, so the analytics features have something interesting to show.
 *
 * Run:  npm run generate:sample
 * Output: data/sample-grievances.json
 */
const fs = require('fs');
const path = require('path');

// ---------- deterministic PRNG (mulberry32) ----------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260916);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function weightedPick(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rnd() * total;
  for (const [val, w] of pairs) { r -= w; if (r <= 0) return val; }
  return pairs[pairs.length - 1][0];
}

// ---------- helpers ----------
const TODAY = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; };

const PLACES = [
  'MG Road', 'the market junction', 'the bus stand road', 'the school lane',
  'the flyover approach', 'the hospital road', 'the railway station road',
  'the park gate', 'the temple street corner', 'the community hall road',
  'the lake view road', 'the industrial area gate', 'the old post office road',
  'the college hostel road'
];

const TEMPLATES = {
  roads: [
    'Deep pothole near {place}, two-wheelers swerve dangerously to avoid it',
    "Cracked and broken stretch of road near {place} after last week's rain",
    'Pothole filling done last month near {place} has already worn out',
    'Speed-breaker near {place} has faded markings and a chipped edge',
    'Loose gravel and debris on the road near {place} causing skidding',
    'Road surface near {place} has sunk where a pipeline was recently laid'
  ],
  streetlights: [
    'Streetlight not working for two weeks near {place}, stretch is pitch dark after 7pm',
    'Three consecutive streetlight poles are dark near {place}, women feel unsafe walking',
    'Streetlight near {place} flickers all night and disturbs residents',
    'New LED streetlight installed near {place} is facing the wrong direction',
    'Streetlight pole near {place} is leaning dangerously after the storm'
  ],
  water: [
    'Irregular water supply in our street near {place}, taps run dry every morning',
    'Water pressure extremely low near {place} for the past four days',
    'Suspected pipeline leak near {place} wasting large amounts of water',
    'Discoloured and muddy water supplied near {place} since Monday',
    'Tanker water needed near {place} as pipeline supply has stopped'
  ],
  sanitation: [
    'Garbage not collected from bins near {place} for three days, overflow and stench',
    'Street sweeping has not happened near {place} this week',
    'Open garbage dumping point near {place} attracting stray animals',
    'Dustbins near {place} are broken and waste is scattered on the road',
    'Sanitation workers not covering the full street near {place} on collection days'
  ],
  drainage: [
    'Drain blocked near {place} and dirty water overflows onto the road',
    'Storm water drain near {place} clogged with plastic and silt',
    'Drain cover missing near {place}, dangerous for pedestrians at night',
    'Sewage backflow into homes near {place} whenever it rains',
    'Drainage chamber near {place} overflowing for two days'
  ],
  encroachment: [
    'Footpath near {place} fully occupied by hawkers, pedestrians forced onto the road',
    'Construction material dumped on the road near {place} blocking traffic',
    'Encroachment of park land near {place} with temporary sheds',
    'Vehicles parked permanently on footpath near {place}',
    'Unauthorised hoardings blocking visibility at the junction near {place}'
  ],
  noise: [
    'Loudspeakers played past permitted hours near {place} every night this week',
    'Construction work near {place} continues through the night',
    'Diesel generator set near {place} runs all day at very high noise',
    'Festival loudspeakers near {place} start at 4am disturbing residents',
    'Vehicles with altered silencers racing near {place} late at night'
  ],
  other: [
    'Stray dog menace near {place}, children afraid to play outside',
    'Public toilet near {place} locked and unusable for weeks',
    'Park bench and play equipment near {place} broken',
    'Fallen tree branches near {place} not cleared after the storm',
    'Street name boards near {place} faded or missing'
  ]
};

// High-urgency (safety-critical) complaint pool
const HIGH_URGENCY = [
  { text: 'Live electrical wire exposed from a streetlight pole near {place}, sparks seen, very dangerous', category: 'streetlights' },
  { text: 'Open manhole without any cover or barricade near {place}, a child fell and was injured', category: 'drainage' },
  { text: 'Sewage water mixing with the drinking water line near {place}, several residents falling sick', category: 'water' },
  { text: 'Road caved in near {place} after heavy rain, half the carriageway has collapsed', category: 'roads' },
  { text: 'Distribution transformer near {place} leaking oil and buzzing loudly, smells of burning', category: 'streetlights' },
  { text: 'Overhead cable hanging low across the road near {place}, buses almost touching it', category: 'streetlights' },
  { text: 'Parked gas cylinder cart leaking near {place}, strong smell, public at risk', category: 'other' },
  { text: 'Abandoned well near {place} left uncovered behind the demolished building', category: 'other' },
  { text: 'Water tank overflow near {place} has made the entire lane slippery, two accidents already', category: 'water' },
  { text: 'Electric junction box near {place} broken open, wires accessible to children', category: 'streetlights' }
];

const CAT_WEIGHTS = [
  ['roads', 22], ['sanitation', 16], ['streetlights', 14], ['water', 13],
  ['drainage', 11], ['noise', 8], ['encroachment', 8], ['other', 8]
];
const WARD_WEIGHTS = [ // index 0 -> Ward 1 ...
  5, 7, 9, 4, 6, 8, 12, 5, 7, 6, 9, 13
];
const RES_DAYS = {
  roads: [5, 21], streetlights: [3, 14], water: [2, 10], sanitation: [2, 7],
  drainage: [4, 18], encroachment: [10, 30], noise: [3, 12], other: [3, 15]
};

function fillTemplate(tpl) {
  return tpl.replace('{place}', pick(PLACES));
}

// mutation for near-duplicates: light rewording keeps trigram similarity high
function mutateText(text) {
  const variants = [
    (t) => t.replace(/^Deep /, 'Big '),
    (t) => t.replace(/, /g, ' - '),
    (t) => t + '. Please fix this urgently.',
    (t) => 'Repeated complaint: ' + t,
    (t) => t.replace(/near /, 'at '),
    (t) => t.replace(/dangerously /, '').replace(/extremely /, '')
  ];
  return pick(variants)(text);
}

function makeStatus(urgency, cat, daysBack) {
  let status;
  const r = rnd();
  if (urgency === 'high') status = r < 0.55 ? 'open' : (r < 0.9 ? 'in-progress' : 'resolved');
  else status = r < 0.45 ? 'resolved' : (r < 0.7 ? 'in-progress' : 'open');
  let resolvedDate = null;
  if (status === 'resolved') {
    const [lo, hi] = RES_DAYS[cat] || [3, 15];
    let d = RES_DAYS[cat] ? rint(lo, hi) : rint(3, 15);
    if (d > daysBack) d = daysBack; // never resolve in the future
    if (d < 1) d = 1;
    resolvedDate = iso(daysAgo(daysBack - d));
  }
  return { status, resolvedDate };
}

function sentimentFor() {
  const r = rnd();
  if (r < 0.45) return 'frustrated';
  if (r < 0.85) return 'neutral';
  return 'informational';
}

function daysBetween(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.round((TODAY - d) / 86400000));
}

// ---------- build rows ----------
const rows = [];

// 1) 132 base complaints spread over ~120 days (recent-biased)
for (let i = 0; i < 132; i++) {
  const cat = weightedPick(CAT_WEIGHTS);
  const daysBack = Math.min(119, Math.floor(120 * Math.pow(rnd(), 1.35)));
  const ward = 'Ward ' + weightedPick(WARD_WEIGHTS.map((w, idx) => [idx + 1, w]));
  const text = fillTemplate(pick(TEMPLATES[cat]));
  let urgency = 'low';
  const u = rnd();
  if (u < 0.08) urgency = 'high'; else if (u < 0.38) urgency = 'moderate';
  const { status, resolvedDate } = makeStatus(urgency, cat, daysBack);
  rows.push({ text, category: cat, ward, date: iso(daysAgo(daysBack)), status, resolvedDate, urgency, sentiment: sentimentFor() });
}

// 2) 10 high-urgency safety complaints, all recent
for (let i = 0; i < 10; i++) {
  const tpl = pick(HIGH_URGENCY);
  const daysBack = rint(0, 14);
  const ward = 'Ward ' + weightedPick(WARD_WEIGHTS.map((w, idx) => [idx + 1, w]));
  const { status, resolvedDate } = makeStatus('high', tpl.category, daysBack);
  rows.push({
    text: fillTemplate(tpl.text), category: tpl.category, ward,
    date: iso(daysAgo(daysBack)), status, resolvedDate,
    urgency: 'high', sentiment: 'frustrated'
  });
}

// 3) Ward 7 drainage spike: 12 complaints in the last 10 days
for (let i = 0; i < 12; i++) {
  const daysBack = rint(0, 9);
  const text = fillTemplate(pick(TEMPLATES.drainage));
  const urgency = rnd() < 0.3 ? 'high' : 'moderate';
  const { status, resolvedDate } = makeStatus(urgency, 'drainage', daysBack);
  rows.push({ text, category: 'drainage', ward: 'Ward 7', date: iso(daysAgo(daysBack)), status, resolvedDate, urgency, sentiment: sentimentFor() });
}

// 4) 18 near-duplicate re-reports of existing complaints (same ward, similar text)
const dupSources = [];
while (dupSources.length < 18) {
  const idx = rint(0, rows.length - 1);
  if (!dupSources.includes(idx)) dupSources.push(idx);
}
for (const idx of dupSources) {
  const src = rows[idx];
  const daysBack = Math.max(0, daysBetween(src.date) - rint(0, 3));
  const { status, resolvedDate } = makeStatus(src.urgency, src.category, daysBack);
  rows.push({
    text: mutateText(src.text), category: src.category, ward: src.ward,
    date: iso(daysAgo(daysBack)), status, resolvedDate,
    urgency: src.urgency, sentiment: sentimentFor()
  });
}

// shuffle + assign ids
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]];
}
const out = rows.map((r, i) => ({
  id: 'CL-' + String(i + 1).padStart(4, '0'),
  ...r
}));

const dest = path.join(__dirname, 'sample-grievances.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log('Wrote ' + out.length + ' sample grievances to ' + dest);
const counts = {};
out.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });
console.log('Category counts:', JSON.stringify(counts));
