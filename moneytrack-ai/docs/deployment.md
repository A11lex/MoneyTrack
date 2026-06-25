# Deployment

## Backend on Render

Root directory:

```text
backend
```

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

The included `backend/render.yaml` can also be used as a Render blueprint.

Environment variables:

```text
PYTHON_VERSION=3.12.13
DATABASE_URL=moneytrack.db
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
```

Do not commit real LINE secrets to Git.

## Frontend on Vercel

Root directory:

```text
frontend
```

Environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com
```

Build command:

```bash
npm run build
```

## CORS

The backend currently allows local frontend origins. Before deploying a production frontend domain, add the Vercel domain to `allow_origins` in `backend/app/main.py`.

## LINE Webhook URL

After the backend is deployed, set the LINE Developers webhook URL to:

```text
https://your-render-service.onrender.com/line/webhook
```

Then enable webhook usage in the LINE Messaging API settings.

## Database

The MVP uses SQLite. Render instances may have ephemeral storage depending on plan and configuration. For durable production data, replace SQLite with Postgres and add migrations.
