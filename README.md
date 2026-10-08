# Apex Learn

A financial literacy education platform, built from the trading/market-data
engine originally developed for the Apex Markets behavioral-finance research
study. **This is a separate product codebase and a separate database** —
nothing here reads from or writes to the Apex research project's Firestore
instance, and nothing in the research project was modified to build this.

## What this is (and isn't)

Apex Learn turns "how do people make financial decisions?" (the research
question) into "help people understand financial concepts by making
decisions and seeing the consequences" (the product question). There is no
consent flow, no experimental group assignment, no IRB language, and no
research surveys here — those stay in the original Apex research repo.

This is an **educational simulation**. It does not use real money, does not
provide personalized financial advice, and should not be treated as a
real investment platform. Market data is either a live free-tier quote or a
clearly-labeled fallback price (`"fallback": true`) when the live source is
unavailable — the UI should never present a fallback price as a live one.

## Architecture

- **Backend:** Node.js + Express (`server.js`), same stack as the research
  app for consistency, but entirely new route logic.
- **Database:** SQLite via `better-sqlite3` (`apex-learn.db`, created on
  first run) — a single file, zero external service required, and
  completely separate from the research project's Firestore.
- **Auth:** simple email/password with `express-session` + `bcryptjs`. Not
  Firebase Auth — kept independent on purpose per the "separate product"
  requirement.
- **Market data (`src/market-data.js`):** adapted from the research
  server's Yahoo Finance fetch logic, trimmed to a 9-ticker teaching
  universe (mega-cap tech, a broad-market ETF, bonds, gold, energy, and one
  leveraged ETF to make concentration visible) instead of the research
  app's full multi-hundred-ticker universe. Polls every 60s instead of every
  ~25s, since an education product doesn't need research-grade freshness.
- **Frontend (`public/`):** single-file vanilla JS app (`app.js`), same
  low-dependency approach as the research frontend, but all new code.

### Data model (`src/db.js`)

`users`, `modules`, `user_progress`, `simulations`, `events`, plus
`organizations` / `cohorts` / `cohort_members` as a minimal placeholder for
future nonprofit/instructor integration (join-code based cohort membership,
an instructor-only aggregate report endpoint). None of this is wired to a
full UI yet — it exists so the next person doesn't have to redesign the
schema to add it.

## What's implemented right now

- Sign up / log in / log out (session-based).
- Student dashboard: modules completed, per-module status, simulations
  completed count.
- **One complete educational module end-to-end: Diversification.**
  Learn (short explanation) → Try (build a portfolio allocation across 9
  real-ish assets) → Results (what happened, concentration score) →
  Explain (why, in plain language) → Reflect (two short free-text
  questions) → Retry/Next.
- Simulation engine: three pre-defined, labeled market scenarios (tech
  selloff, energy shock, broad rally) scored against the user's actual
  allocation, plus an equal-weight benchmark for comparison. This is
  intentionally much simpler than the research app's live multi-minute
  trading session — the teaching point is portfolio construction and
  concentration, not order execution.
- Product analytics events (`account_created`, `module_started`,
  `module_completed`, `simulation_started`, `simulation_completed`,
  `quiz_completed`, `user_returned`) logged to the `events` table.
- The remaining 5 modules (Investing Basics, Risk and Return, Market
  Volatility, Behavioral Biases, Long-Term Investing) exist as rows in the
  `modules` table with `status: 'coming_soon'` — they show up on the
  dashboard as locked/upcoming so the information architecture is visible,
  but have no content yet.
- Minimal cohort architecture: join-code endpoint + an instructor-only
  aggregate completion report endpoint. No instructor UI yet.

## How to run it locally

```bash
cd apex-learn
npm install
cp .env.example .env   # edit SESSION_SECRET if you want
npm start
```

Then open `http://localhost:8081`. The SQLite database file
(`apex-learn.db`) is created automatically on first run, in this directory.

No API keys are required to run it — market data falls back to labeled
example prices if the free Yahoo endpoint is unavailable or rate-limited
(common from shared/cloud IPs). `POLYGON_KEY` / `FINNHUB_KEY` in `.env` are
optional future hooks, not currently wired into `market-data.js`.

## Next highest-priority features

1. **Build out 1-2 more modules** (Risk and Return is the most natural
   next one — the simulation engine already generalizes to "allocate,
   apply a scenario, compare to a benchmark," so a new module is mostly new
   content + a new scenario set, not new infrastructure).
2. **A real instructor/cohort UI** — the backend (join codes, aggregate
   report endpoint) exists; there's no screen for an instructor to create a
   cohort or view the report yet.
3. **Replace the 3 hand-picked scenarios with a small library** of
   labeled historical-pattern scenarios (still not live prediction — just
   more teaching variety than 3 fixed cases).
4. **Account recovery / password reset** — there is currently no
   forgot-password flow, which is fine for a prototype but not for anything
   with real users.
5. **A lightweight admin/content view** so modules can be added or edited
   without touching code directly — right now every new module requires a
   code change in `MODULE_CONTENT` (client) and a new route (server).
