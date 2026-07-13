# Production Release Checklist

Use this checklist for every production release. A successful build alone is not enough because LINE login, webhook delivery, and scheduled jobs depend on external services.

## 1. Automated checks

- GitHub Actions `backend` job passes `pytest -q`.
- GitHub Actions `frontend` job passes Node tests, lint, typecheck, and `next build`.
- Render deploy is green and `GET /health` returns `{"status":"ok","database":"ok"}`.
- Vercel production deploy is green.

## 2. Production configuration

Render must have:

```text
DATABASE_URL
FRONTEND_ORIGIN
LIFF_APP_BASE_URL
LINE_LOGIN_CHANNEL_ID
LINE_AUTH_REQUIRED=1
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
LINE_RICH_MENU_MAIN_ID
CRON_SECRET
SEED_DEMO_DATA=0
```

Vercel must have:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_LIFF_ID
NEXT_PUBLIC_FRONTEND_ORIGIN
```

The LIFF endpoint URL must use the Vercel production origin. The LINE webhook URL must end with `/line/webhook` on the Render service.

## 3. LINE smoke test

Test with two different LINE accounts on real phones:

1. A new account opens LIFF and is sent to onboarding.
2. After onboarding, the same account opens the summary without onboarding again.
3. The LINE display name and profile image are shown.
4. Send `ข้าว 80` in chat. One success Flex Message appears and the web transaction list shows the same item.
5. Edit and delete the item from the Flex Message links.
6. Configure a budget and verify the remaining-budget section appears on the next expense.
7. Confirm the second LINE account cannot see the first account's transactions, budgets, categories, or settings.
8. Verify all Rich Menu areas open the intended LIFF routes and the large area returns the quick-start Flex Message.

## 4. Scheduled jobs

- Trigger `/recurring-transactions/run-due` twice with the same due item and date. Only one transaction may be created.
- Verify the recurring Flex Message is pushed once.
- Verify daily reminder timing with the user's configured timezone.
- Do not rely on an in-process worker while the Render free service is asleep. Use a Render Cron Job or another reliable scheduler for public production use.

## 5. Security and recovery

- Rotate any LINE access token or `CRON_SECRET` that has appeared in a screenshot or terminal recording.
- Keep PostgreSQL backups and test one restore before public launch.
- Confirm unsigned webhooks and mock endpoints are disabled in production.
- Monitor Render logs for `401`, `403`, `409`, `500`, and `503` responses during the first release.

