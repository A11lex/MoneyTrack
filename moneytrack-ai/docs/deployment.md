# Deployment

## Backend on Render

Root directory:

```text
moneytrack-ai/backend
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
DATABASE_URL=postgresql://user:password@host/database
FRONTEND_ORIGIN=https://money-track-sandy.vercel.app
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_RICH_MENU_MAIN_ID=richmenu-id-created-by-the-setup-script
LINE_LOGIN_CHANNEL_ID=2010521304
LINE_AUTH_REQUIRED=1
LIFF_APP_BASE_URL=https://liff.line.me/2010521304-BrGvBhsP
LINE_WEBHOOK_ALLOW_UNSIGNED=0
ENABLE_LINE_WEBHOOK_MOCK=0
CRON_SECRET=generate-a-long-random-value
SEED_DEMO_DATA=0
```

Do not commit real LINE secrets to Git.

## Frontend on Vercel

Root directory:

```text
moneytrack-ai/frontend
```

Environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_LIFF_ID=your-liff-id
NEXT_PUBLIC_FRONTEND_ORIGIN=https://your-vercel-domain.vercel.app
```

Build command:

```bash
npm run build
```

## CORS

Set `FRONTEND_ORIGIN` on Render to your Vercel production domain if it changes.

The frontend sends the LIFF ID token in the `Authorization` header. The backend verifies it with LINE and rejects a `line_user_id` that does not match the verified token. Keep `LINE_AUTH_REQUIRED=1` outside automated tests.

`LIFF_APP_BASE_URL` must use the official `https://liff.line.me/{LIFF_ID}` URL. Flex Message buttons use this value so profile and login context remain available when users open app pages from LINE.

## LINE Webhook URL

After the backend is deployed, set the LINE Developers webhook URL to:

```text
https://your-render-service.onrender.com/line/webhook
```

Then enable webhook usage in the LINE Messaging API settings.

## LINE Rich Menus

The app supports two LINE Rich Menus:

- Start menu: default menu for new users. The whole image opens the LIFF onboarding page.
- Main menu: linked to the user after onboarding is completed.

Place the menu images in:

```text
moneytrack-ai/backend/assets/rich-menu/ListMenuStart.png
moneytrack-ai/backend/assets/rich-menu/ListMenuMain.png
```

Run this locally after setting `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`, and the public LINE Official Account page URL:

```bash
LINE_OA_URL=https://page.line.me/your-basic-id
python scripts/setup_rich_menus.py
```

On PowerShell:

```powershell
$env:LINE_OA_URL="https://page.line.me/your-basic-id"
py scripts/setup_rich_menus.py
```

The large Rich Menu area sends the quick-start Flex Message with the **จดเลย** button. The announcement area opens `LINE_OA_URL`.

The script prints:

```text
LINE_RICH_MENU_START_ID=...
LINE_RICH_MENU_MAIN_ID=...
```

Add `LINE_RICH_MENU_MAIN_ID` to Render. The script automatically sets the Start menu as the default rich menu for all users.

## Database

Local development and automated tests can continue using SQLite. Production must use PostgreSQL because a Render web service filesystem is ephemeral.

The included Blueprint creates `moneytrack-ai-db` and injects its connection string into `DATABASE_URL`. If the existing web service was created manually, create a Render PostgreSQL database and add its **Internal Database URL** as `DATABASE_URL` on the web service before deploying this version.

To copy an existing SQLite file into an empty PostgreSQL database:

```powershell
cd backend
$env:DATABASE_URL="postgresql://user:password@external-host/database"
python scripts/migrate_sqlite_to_postgres.py --source moneytrack.db
```

Use Render's **External Database URL** only for this local migration command; the deployed backend should keep using the Internal Database URL. The migration is safe to rerun: existing primary keys and unique rows are skipped. Back up the SQLite file before running it. Do not expose `DATABASE_URL` in screenshots or commit it to Git.

After migration, verify that users, transactions, categories, budgets, recurring entries, reminders, and settings have non-zero row counts before redeploying the backend.

## Release verification

Every push and pull request is verified by `.github/workflows/ci.yml`. Before exposing the LINE Official Account publicly, complete [release-checklist.md](release-checklist.md), including the two-account isolation test on real phones.

Render's free web service can sleep when inactive. This delays the first request and pauses the in-process recurring worker. Use a dedicated Render Cron Job or another reliable scheduler before treating recurring entries and reminders as production guarantees.
