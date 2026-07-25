# Activity Log

## 2026-07-25

Worked from the implementation plan for the Expense Splitter, then did a
review-and-fix pass on the codebase (AI-assisted).

### Features added (from the implementation plan)
- 📅 Date field on the Add Expense form
- 🔍 Search / filter bar on the Expense Log
- ✏️ Edit button per expense, with a full edit modal
- 🗑️ Delete button per expense
- 🔧 Backend endpoints: `PUT /expense/<id>` and `DELETE /expense/<id>`
- 🐛 Fixed the `datetime.utcnow()` deprecation warning

### Review & error fixing (AI-assisted)
- 🐞 Fixed an `AttributeError` crash in the CSV backup helper (`datetime.UTC`
  used on the class) that broke every expense edit/delete
- 💱 Fixed inverted currency conversion — amounts are stored in PKR and now
  convert correctly on display (divide by rate instead of multiply)
- 🧹 Removed the destructive, non-idempotent `/convert/data` endpoint (it
  rewrote stored amounts in place and double-converted on repeat calls)
- ⚖️ Unified two conflicting exchange-rate tables into one source of truth
- 🔢 Input validation now rejects non-numeric amounts with a 400 instead of a
  500 error

### Storage & deployment
- 🗄️ Migrated storage from CSV files to a database (SQLAlchemy): SQLite for
  local dev, Postgres in production. Existing CSV data auto-imports on first
  run. This fixes data being wiped on the host's ephemeral disk.
- 🚀 Added deployment config: `render.yaml` (Flask API + free Postgres),
  updated `requirements.txt` (gunicorn / SQLAlchemy / psycopg2), a configurable
  API base URL via `VITE_API_BASE`, and a step-by-step `DEPLOY.md`
  (Render + Vercel).

**Commits:** `0e6fdef` (features), `c9c65bf` (fixes + DB + deploy config)
