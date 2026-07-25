# HealthyFood Companion — Discovery Gradhack 2026

A personalised, AI-driven nutrition companion. It reads a customer's real
Discovery purchase history and turns it into a health profile, a live pantry,
AI-generated recipes, habit tracking, heritage-day discovery, and a
collaborative neighbourhood cook-along.

Built on **Google Cloud**: React + Vite frontend, Node/Express backend,
**Vertex AI (Gemini)** for recipes and the in-app assistant.

---

## What's in the box

```
frontend/         React + Vite app (6 screens, navy Discovery theme)
backend/
  server.js       Vertex AI proxy  (secure Gemini access for the AI assistant)
  data-server.js  Data API         (reads the Excel, serves /profile /pantry /recipes …)
```

Two independent backend servers:

* server.js (port 5000) — original secure proxy so the browser can call Gemini
  for the chat assistant. Leave as-is.
* data-server.js (port 5001) — the real data API. Reads the transactions Excel,
  computes health scores / pantry / progress from actual purchases, generates
  recipes via Vertex AI with a safe fallback.

The frontend uses the data API when VITE_API_URL points at it, and falls back to
built-in mock data if unreachable — so the demo can never blank-screen.

---

## One-time setup

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

Put the real data file at backend/transactions.xlsx (or set TRANSACTIONS_FILE
in backend/.env.local).

Google Cloud auth (for live Gemini):
```bash
gcloud auth application-default login
```
Enable APIs once: aiplatform.googleapis.com, run.googleapis.com.

---

## Run it

```bash
# Terminal 1 — data API (real Excel data)   → http://localhost:5001
cd backend && npm run data

# Terminal 2 — Vertex proxy (AI assistant)  → http://localhost:5000
cd backend && npm run dev

# Terminal 3 — frontend                      → http://localhost:5173
cd frontend && npm run dev
```

Point the frontend at the data API — create frontend/.env.local:
```
VITE_API_URL=http://localhost:5001
```

Confirm the pipe:
```bash
curl http://localhost:5001/health
# → { "ok": true, "loaded": true, "customers": N, "data_source": "excel" }
```

---

## Demo login

```
username: aisha
password: demo123      → CUST-001 (Aisha Van Wyk)
```

Data endpoints also work directly by customer_id, so the demo never blocks on auth.

---

## Endpoints (data-server.js)

```
GET  /health
POST /auth/register        { username, password, customer_id }
POST /auth/login           { username, password } → { token, customer_id, name }
GET  /profile/:id
PUT  /profile/:id/preferences
GET  /pantry/:id
POST /pantry/:id/add       { name }
GET  /recipes/:id?event=&goal=&power=
GET  /progress/:id
GET  /heritage/today
GET  /community/:id
```

All shapes match the frontend's api.ts exactly.

---

## How it satisfies the brief

1. Personalised recommendations — recipes from the real pantry, scaled to
   household, budget-aware, allergy/diet-filtered.
2. Purchase & activity tracking — pantry derived from real baskets with
   category-based expiry; health score + adoption tracked week over week.
3. Discovery data integration — classification uses real Main category values;
   scores computed from real Line total (ZAR).
4. Evolving profile — preferences feed every recommendation.
5. Data ingestion — auto from Discovery data, manual add, till-slip scan entry.

AI safety: allergen exclusion is enforced in code — stripped before the model
sees the pantry and re-checked on every returned recipe. The model is never
trusted for the safety-critical rule.

---

## Deploy (Cloud Run)

```bash
cd backend
gcloud run deploy hf-data-api --source . --region <region> --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=<proj>,GOOGLE_CLOUD_LOCATION=<loc>,JWT_SECRET=<secret>,GEMINI_MODEL=gemini-2.5-flash
```
Then set the frontend's VITE_API_URL to the Cloud Run URL and rebuild.

Prototype for Discovery Gradhack 2026. Not for production use.
