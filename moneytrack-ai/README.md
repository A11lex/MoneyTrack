# MoneyTrack AI

MoneyTrack AI is a full-stack personal and small-business finance dashboard that tracks income, expenses, cashflow, risk, and next-step recommendations without using paid AI APIs.

## Problem Statement

Basic expense trackers record transactions but rarely explain what the numbers mean. Users need to know where money goes, whether spending is too high, how cashflow is trending, and what actions to take before the month ends.

## Solution

MoneyTrack AI combines transaction CRUD, financial formulas, charts, a rule-based AI-style advisor, a what-if simulator, and a financial health score. The MVP is designed as a Junior Full Stack + AI portfolio project with clean backend calculations and a professional SaaS UI.

## Features

- Transaction create, edit, delete, and list workflows
- Personal and business modes
- Default income and expense categories
- Total income, total expense, net balance, savings rate, expense-to-income ratio, current-month cashflow, and projected end-of-month balance
- Income vs expense, expense by category, daily cashflow, and personal vs business spending charts
- Rule-based financial advisor with executive summary, key risks, warnings, actions, and saving opportunities
- Mock LINE webhook for natural-language Thai transaction messages
- What-if simulator for reducing food, shopping, debt, and business costs while increasing income
- Financial health score from 0-100 with Low, Medium, or High risk
- English and Thai UI labels
- Dark mode
- FastAPI + SQLite backend with Pandas and NumPy analysis
- Deployment-ready structure for Vercel frontend and Render backend

## Tech Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, Recharts, lucide-react
- Backend: FastAPI, Python, SQLite
- Data analysis: Pandas, NumPy
- Tests: pytest, Next.js lint/typecheck/build

## Architecture

```text
moneytrack-ai/
  frontend/          Next.js dashboard and CRUD UI
  backend/           FastAPI API, SQLite repository, finance logic
  docs/              Spec, architecture, deployment, resume bullets
```

The frontend talks to the backend through `NEXT_PUBLIC_API_BASE_URL`. The backend stores transactions in SQLite and exposes summarized analytics through `/dashboard`.

## Screenshots

Add screenshots after running the app locally:

- Dashboard overview
- Transaction form and table
- Advisor and what-if simulator
- Dark mode

## Local Setup

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Test Commands

Backend:

```powershell
cd backend
python -m pytest
```

Frontend:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Mock LINE Webhook

Before connecting to LINE Developers, the backend exposes a local mock endpoint:

```powershell
curl -X POST http://localhost:8000/line/webhook `
  -H "Content-Type: application/json" `
  -d "{\"line_user_id\":\"test-user-001\",\"message\":\"ข้าว 80\"}"
```

Example response:

```json
{
  "reply": "บันทึกแล้ว: รายจ่าย 80 บาท\nหมวด: Food\nโหมด: ส่วนตัว",
  "handled": true
}
```

Supported first-pass commands include natural transaction messages such as `ข้าว 80`, `รับเงินลูกค้า 2500`, and the summary command `สรุปวันนี้`.

The same endpoint also accepts LINE Messaging API-style event payloads:

```json
{
  "events": [
    {
      "type": "message",
      "replyToken": "reply-token-001",
      "source": { "userId": "line-user-001" },
      "message": { "type": "text", "text": "รับเงินลูกค้า 2500" }
    }
  ]
}
```

For now, the backend returns prepared replies in JSON. The next integration step is to verify LINE signatures and send these replies through LINE's Reply API.

When `LINE_CHANNEL_SECRET` is set, `/line/webhook` verifies `X-Line-Signature` for LINE event payloads. When `LINE_CHANNEL_ACCESS_TOKEN` is set, the backend sends replies through LINE's Reply API.

## Deployment

- Frontend: deploy `frontend/` to Vercel and set `NEXT_PUBLIC_API_BASE_URL` to the Render API URL.
- Backend: deploy `backend/` to Render using `render.yaml` or the start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Database: SQLite is suitable for MVP/demo usage. For production multi-user SaaS, migrate to Postgres.

## Roadmap

- Authentication and multi-user accounts
- Import CSV/bank statements
- Budget goals and recurring transaction detection
- Postgres production database
- More advanced forecasting and anomaly detection
- Optional LLM advisor integration behind a feature flag
