# CivicLens - Smart City Grievance Analysis & Resolution Insights System

**An analytics & awareness tool for education - NOT an official grievance portal.**

> CivicLens is an analytics and awareness tool for educational purposes. Insights are indicative,
> not official. Always escalate grievances through your city's official channels.

A student sustainability project for the **1M1B / IBM SkillsBuild** initiative under the theme
*Technology for social impact and sustainability*, aligned with:

- **UN SDG 11** - Sustainable Cities & Communities
- **UN SDG 16** - Peace, Justice and Strong Institutions

It helps municipal grievance-redressal staff, ward officers, civic volunteers and engaged citizens
understand, categorise and prioritise public complaints (potholes, streetlights, water supply,
garbage, drainage, noise, ...) through transparent dashboards, AI-assisted classification, duplicate
detection and plain-language insights.

---

## Quick start

**Prerequisites:** Node.js 18 or newer. Everything else is free-tier friendly.

```bash
# 1. install dependencies (express + dotenv only)
npm install

# 2. configure your Gemini API key
cp .env.example .env
#    then edit .env and set GEMINI_API_KEY=... (get a free key at https://aistudio.google.com/app/apikey)

# 3. run
npm start
```

Open **http://localhost:3000** in your browser. The app works even *without* an API key - every
analytics feature functions; only the three AI features (classify, chat, daily summary) are disabled
with a clear notice.

### About the Gemini model name

There is **no model called `gemini-3.6-flash`**. The server defaults to **`gemini-2.5-flash`**
(stable, free-tier friendly). To change it, set `GEMINI_MODEL` in `.env` - e.g.
`gemini-3.7-flash` if it is available on your key. (`gemini-2.0-flash` has been shut down by
Google - do not use it.) If the model name is wrong for your key, the API returns a clear
error message telling you exactly what to fix.

---

## Project structure

```
civiclens/
|- package.json              # scripts + dependencies
|- .env.example             # GEMINI_API_KEY placeholder + model config
|- .gitignore
|- README.md                 # this file
|- server/
|   |- server.js             # Express server; keeps the Gemini key server-side
|- data/
|   |- sample-grievances.json     # 172 synthetic grievances (bundled sample data)
|   |- generate-sample.js        # regenerates the sample dataset (npm run generate:sample)
|- public/                   # everything the browser loads
    |- index.html            # single-page app shell (7 views + chat widget)
    |- css/style.css         # civic blue/green theme, mobile-first
    |- js/
        |- app.js            # navigation, init, online/offline status
        |- utils.js          # similarity, stats, aggregation, chart & toast helpers
        |- store.js          # dataset state, CSV parsing + validation, localStorage cache
        |- dashboard.js      # city-wide overview + AI daily summary
        |- dataView.js       # data setup: sample / CSV upload / reset
        |- classify.js       # AI grievance classification (with manual correction)
        |- duplicates.js     # duplicate & cluster detection
        |- analytics.js      # ward/date filters, trends, anomalies
        |- library.js        # grievance awareness library
        |- report.js         # printable report + CSV exports
        |- chat.js           # floating AI insights assistant
```

## Features

1. **Dashboard** - totals, open vs resolved, category bar chart, status doughnut, top-5 ward
   ranking, urgency banner for critical open issues, recent activity, AI daily summary.
2. **Data setup** - built-in 172-row sample dataset, CSV upload with client-side validation
   (row-level error messages for malformed rows), reset-to-sample button.
3. **AI grievance classification** - Gemini detects category, sentiment and urgency with a
   one-line reasoning note; results are manually correctable; corrected rows can be added
   to the dataset.
4. **Duplicate & cluster detection** - same ward + trigram Jaccard text similarity (no paid
   embeddings API), adjustable threshold, cluster view with "likely original" highlighting.
5. **Ward & trend analytics** - ward/date filters, weekly trend line chart, stacked category
   bars per ward, average resolution time per category, week-over-week spike alerts (>25%).
6. **Grievance library** - plain-language guide to 8 common complaint types: causes, responsible
   departments, expected timelines, official escalation paths, citizen tips.
7. **AI insights assistant** - floating chat grounded ONLY in the loaded dataset; system prompt
   forbids legal/departmental directives and always appends a "verify with the concerned
   municipal department" note.
8. **AI daily summary** - top 3 issues to watch, spike alert, one civic-awareness tip; cached
   per day in localStorage.
9. **Report & export** - print-friendly HTML report (save as PDF via the browser's print
   dialog) including category counts, ward ranking, urgency distribution and the AI summary;
   CSV exports of analytics and of the filtered grievance rows.
10. **Offline-friendly** - dataset, preferences and the daily summary are cached in
    localStorage; a header pill shows "Offline - cached data, updated <time>"; charts degrade
    gracefully if the Chart.js CDN is unreachable.

## CSV upload format

Header row required; column names are matched case-insensitively:

| Required | Accepted headers |
| --- | --- |
| Complaint text | `text`, `complaint`, `complaint text`, `description`, `grievance` |
| Category | `category`, `type`, `complaint type` |
| Ward | `ward`, `ward no`, `ward number`, `zone` |
| Date | `date`, `filed date`, `created date` (YYYY-MM-DD or DD/MM/YYYY) |
| Status | `status` (open / in-progress / resolved; synonyms normalised) |

Optional columns: `resolved date`, `urgency` (low/moderate/high), `sentiment`, `id`.

Rows with empty text/ward or invalid dates are skipped with a clear error message. Max 5,000
rows / 5 MB. **Use anonymised data only** - no names, phone numbers or personal addresses.

## Tech notes

- **Stack:** HTML5/CSS3/vanilla JS frontend; Node.js + Express backend. The backend exists purely
  to keep the Gemini API key off the client. No login, no database - `localStorage` for
  preferences and cached state.
- **AI:** Google Gemini API via the `generateContent` REST endpoint, called server-side only.
  Simple in-memory rate limiting (30 requests/minute) protects the free-tier quota.
- **Similarity:** character-trigram Jaccard similarity computed locally - no embeddings API.
- **Regenerate the sample data** with fresh dates at any time: `npm run generate:sample`.
- Accessibility: semantic landmarks, skip link, ARIA labels on tabs/charts, visible focus
  styles, colour-contrast-checked theme.

## Disclaimer

CivicLens is an analytics and awareness tool for educational purposes. Insights are indicative,
not official. Always escalate grievances through your city's official channels (municipal
helpline, ward office, official app). This project is not affiliated with any municipal body.

## Credits

Student sustainability project - 1M1B / IBM SkillsBuild. Charts by [Chart.js](https://www.chartjs.org).
AI features by the Google Gemini API (free tier). UN SDG icons/colours used indicatively for
educational framing.
