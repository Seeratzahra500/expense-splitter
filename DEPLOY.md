# Deploying Expense Splitter

**Backend** (Flask + Postgres) → **Render**  ·  **Frontend** (React/Vite) → **Vercel**

Deploy the backend first — you need its URL for the frontend, and the
frontend URL for the backend's CORS. Order: Render → Vercel → update Render.

---

## 0. Push to GitHub (one time)

The project is a local git repo with no remote yet. Create an empty GitHub
repo, then:

```bash
cd ~/expense-splitter
git add .
git commit -m "Prepare for deployment: DB storage, env config"
git remote add origin https://github.com/<you>/expense-splitter.git
git push -u origin main
```

---

## 1. Database → Neon (free Postgres, doesn't expire)

Render's own free Postgres tier auto-deletes the database after 30 days —
that's why the old setup died. Neon's free tier has no expiry (it just
autosuspends when idle and wakes instantly on the next query).

1. [neon.tech](https://neon.tech) → sign up → **New Project** →
   name it `expense-splitter`.
2. Copy the connection string shown (starts with `postgresql://...`).

## 2. Backend → Render

The repo includes `render.yaml`, which provisions the web service.

1. Render dashboard → **New → Blueprint** → select this repo → **Apply**.
2. Render → `expense-splitter-api` → **Environment** → set `DATABASE_URL`
   to the Neon connection string from step 1.2. Leave `FRONTEND_ORIGIN`
   blank for now (defaults to `*`).
3. Wait for the deploy, then copy the service URL, e.g.
   `https://expense-splitter-api.onrender.com`.
4. Sanity check: open `<url>/health` → should return `{"status":"ok"}`.

**Prefer the manual route?** New → Web Service → this repo, then set:
- Root Directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- Set `DATABASE_URL` to the Neon connection string.

> Free tier note: the Render web service sleeps after ~15 min idle (first
> request after wakes it, ~30 s). Data lives in Neon Postgres, so it
> persists across restarts and redeploys.

---

## 2. Frontend → Vercel

1. Vercel → **Add New → Project** → select this repo.
2. Set **Root Directory** to `frontend` (framework auto-detects as Vite).
3. **Environment Variables** → add:
   - `VITE_API_BASE` = your Render URL from step 1.4
     (e.g. `https://expense-splitter-api.onrender.com`)
   - Vite bakes env vars in at **build time**, so this must be set before
     deploying. Change it later? Redeploy.
4. Deploy → copy your Vercel URL, e.g. `https://expense-splitter.vercel.app`.

---

## 3. Lock down CORS (back on Render)

1. Render → `expense-splitter-api` → **Environment** → set
   `FRONTEND_ORIGIN` = your Vercel URL (no trailing slash).
   Multiple origins? Comma-separate them.
2. Save → Render redeploys. Done.

---

## Local development (unchanged)

```bash
# Backend  (uses a local SQLite file at backend/data/expense.db — no Postgres needed)
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
python app.py                                     # http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev                                        # http://localhost:5173
```

Local `VITE_API_BASE` is optional — it defaults to `http://localhost:5000`.

## Environment variables reference

| Where   | Variable          | Purpose                                             |
|---------|-------------------|-----------------------------------------------------|
| Render  | `DATABASE_URL`    | Neon Postgres connection string (set manually)      |
| Render  | `FRONTEND_ORIGIN` | Allowed CORS origin(s); defaults to `*`             |
| Render  | `PORT`            | Set by Render automatically                         |
| Vercel  | `VITE_API_BASE`   | Backend URL the frontend calls                      |
