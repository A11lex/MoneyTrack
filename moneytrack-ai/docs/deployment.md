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
DATABASE_URL=moneytrack.db
FRONTEND_ORIGIN=https://money-track-sandy.vercel.app
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_RICH_MENU_MAIN_ID=richmenu-id-created-by-the-setup-script
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
```

Build command:

```bash
npm run build
```

## CORS

Set `FRONTEND_ORIGIN` on Render to your Vercel production domain if it changes.

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

Run this locally after setting `LINE_CHANNEL_ACCESS_TOKEN` and `NEXT_PUBLIC_LIFF_ID`:

```bash
python scripts/setup_rich_menus.py
```

The script prints:

```text
LINE_RICH_MENU_START_ID=...
LINE_RICH_MENU_MAIN_ID=...
```

Add `LINE_RICH_MENU_MAIN_ID` to Render. The script automatically sets the Start menu as the default rich menu for all users.

## Database

The MVP uses SQLite. Render instances may have ephemeral storage depending on plan and configuration. For durable production data, replace SQLite with Postgres and add migrations.
