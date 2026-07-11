import logging
import asyncio
import os
from contextlib import suppress
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import (
    DATABASE_URL,
    create_recurring_transaction,
    create_transaction,
    delete_recurring_transaction,
    delete_transaction,
    get_daily_reminder_settings,
    get_recurring_transaction,
    get_transaction,
    get_user_setup,
    get_user_settings,
    init_db,
    list_recurring_transactions,
    list_transactions,
    save_daily_reminder_settings,
    save_user_onboarding,
    save_user_settings,
    seed_demo_data,
    update_recurring_transaction,
    update_transaction,
    upsert_line_user,
)
from .database_backend import require_persistent_database
from .daily_reminder_service import run_due_daily_reminders
from .finance import advisor, calculate_summary, chart_data, financial_health_score, simulate_what_if
from .line_adapter import handle_line_events
from .line_auth import LineIdentity, authorize_claimed_line_user, require_line_identity
from .line_client import link_user_rich_menu, send_line_push, send_line_reply
from .line_security import verify_line_signature
from .line_service import LineWebhookPayload, LineWebhookResponse, handle_line_message
from .models import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    DailyReminderSettings,
    DailyReminderSettingsUpdate,
    LineUserUpsert,
    OnboardingPayload,
    RecurringTransaction,
    RecurringTransactionCreate,
    RecurringTransactionUpdate,
    Transaction,
    TransactionCreate,
    TransactionUpdate,
    UserSetup,
    UserSettings,
    UserSettingsUpdate,
    WhatIfScenario,
)
from .recurring_service import run_due_recurring_transactions

app = FastAPI(title="MoneyTrack AI API", version="0.1.0")
logger = logging.getLogger(__name__)


def authenticated_query_line_user(
    line_user_id: str = Query(..., min_length=1),
    identity: LineIdentity | None = Depends(require_line_identity),
) -> str:
    return authorize_claimed_line_user(line_user_id, identity)


def authenticated_path_line_user(
    line_user_id: str,
    identity: LineIdentity | None = Depends(require_line_identity),
) -> str:
    return authorize_claimed_line_user(line_user_id, identity)

frontend_origin = os.getenv("FRONTEND_ORIGIN")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "https://money-track-sandy.vercel.app",
]
if frontend_origin:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    require_persistent_database(DATABASE_URL, os.getenv("RENDER"))
    init_db()
    if os.getenv("SEED_DEMO_DATA", "0") == "1":
        seed_demo_data()
    if os.getenv("ENABLE_RECURRING_WORKER", "1") != "0":
        app.state.recurring_worker_task = asyncio.create_task(_recurring_worker_loop())


@app.on_event("shutdown")
async def shutdown() -> None:
    task = getattr(app.state, "recurring_worker_task", None)
    if task is not None:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


async def _recurring_worker_loop() -> None:
    interval_seconds = int(os.getenv("RECURRING_WORKER_INTERVAL_SECONDS", "60"))
    while True:
        try:
            recurring_result = _run_due_recurring_and_push()
            reminder_result = _run_due_daily_reminders_and_push()
            if recurring_result["processed_count"]:
                logger.info("Recurring worker processed %s item(s)", recurring_result["processed_count"])
            if reminder_result["processed_count"]:
                logger.info("Daily reminder worker pushed %s reminder(s)", reminder_result["processed_count"])
        except Exception:
            logger.exception("Recurring worker failed")
        await asyncio.sleep(max(interval_seconds, 10))


def _run_due_recurring_and_push() -> dict[str, Any]:
    access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")

    def push_message(line_user_id: str, line_message: dict[str, Any]) -> None:
        if access_token:
            send_line_push(line_user_id, line_message, access_token)
        else:
            logger.warning("Recurring item processed without LINE_CHANNEL_ACCESS_TOKEN; flex was not pushed")

    return run_due_recurring_transactions(push_message=push_message)


def _run_due_daily_reminders_and_push() -> dict[str, Any]:
    access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")

    def push_message(line_user_id: str, line_message: dict[str, Any]) -> None:
        if access_token:
            send_line_push(line_user_id, line_message, access_token)
        else:
            logger.warning("Daily reminder processed without LINE_CHANNEL_ACCESS_TOKEN; flex was not pushed")

    return run_due_daily_reminders(push_message=push_message)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/categories")
def categories() -> dict:
    return {"income": INCOME_CATEGORIES, "expense": EXPENSE_CATEGORIES}


@app.get("/transactions", response_model=list[Transaction])
def get_transactions(line_user_id: str = Depends(authenticated_query_line_user)) -> list[Transaction]:
    return list_transactions(line_user_id=line_user_id)


@app.get("/transactions/{transaction_id}", response_model=Transaction)
def get_transaction_by_id(transaction_id: int, line_user_id: str = Depends(authenticated_query_line_user)) -> Transaction:
    transaction = get_transaction(transaction_id, line_user_id=line_user_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@app.post("/transactions", response_model=Transaction, status_code=201)
def post_transaction(payload: TransactionCreate, line_user_id: str = Depends(authenticated_query_line_user)) -> Transaction:
    return create_transaction(payload, line_user_id=line_user_id)


@app.put("/transactions/{transaction_id}", response_model=Transaction)
def put_transaction(transaction_id: int, payload: TransactionUpdate, line_user_id: str = Depends(authenticated_query_line_user)) -> Transaction:
    transaction = update_transaction(transaction_id, payload, line_user_id=line_user_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@app.delete("/transactions/{transaction_id}", status_code=204)
def remove_transaction(transaction_id: int, line_user_id: str = Depends(authenticated_query_line_user)) -> None:
    deleted = delete_transaction(transaction_id, line_user_id=line_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")


@app.get("/recurring-transactions", response_model=list[RecurringTransaction])
def get_recurring_transactions(line_user_id: str = Depends(authenticated_query_line_user)) -> list[RecurringTransaction]:
    return list_recurring_transactions(line_user_id=line_user_id)


@app.get("/recurring-transactions/{recurring_id}", response_model=RecurringTransaction)
def get_recurring_transaction_by_id(recurring_id: int, line_user_id: str = Depends(authenticated_query_line_user)) -> RecurringTransaction:
    item = get_recurring_transaction(recurring_id, line_user_id=line_user_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    return item


@app.post("/recurring-transactions", response_model=RecurringTransaction, status_code=201)
def post_recurring_transaction(payload: RecurringTransactionCreate, line_user_id: str = Depends(authenticated_query_line_user)) -> RecurringTransaction:
    return create_recurring_transaction(payload, line_user_id=line_user_id)


@app.put("/recurring-transactions/{recurring_id}", response_model=RecurringTransaction)
def put_recurring_transaction(
    recurring_id: int,
    payload: RecurringTransactionUpdate,
    line_user_id: str = Depends(authenticated_query_line_user),
) -> RecurringTransaction:
    item = update_recurring_transaction(recurring_id, payload, line_user_id=line_user_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    return item


@app.delete("/recurring-transactions/{recurring_id}", status_code=204)
def remove_recurring_transaction(recurring_id: int, line_user_id: str = Depends(authenticated_query_line_user)) -> None:
    deleted = delete_recurring_transaction(recurring_id, line_user_id=line_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")


@app.post("/recurring-transactions/run-due")
def post_run_due_recurring_transactions(request: Request) -> dict[str, Any]:
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        raise HTTPException(status_code=503, detail="Cron secret is not configured")
    authorization = request.headers.get("Authorization", "")
    if authorization != f"Bearer {cron_secret}":
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    return _run_due_recurring_and_push()


@app.get("/daily-reminder-settings", response_model=DailyReminderSettings)
def get_daily_reminder_settings_endpoint(line_user_id: str = Depends(authenticated_query_line_user)) -> DailyReminderSettings:
    settings = get_daily_reminder_settings(line_user_id)
    if settings is not None:
        return settings
    return DailyReminderSettings(line_user_id=line_user_id, enabled=False, reminder_time="18:00", reminder_mode="missing_only")


@app.put("/daily-reminder-settings", response_model=DailyReminderSettings)
def put_daily_reminder_settings(payload: DailyReminderSettingsUpdate, line_user_id: str = Depends(authenticated_query_line_user)) -> DailyReminderSettings:
    return save_daily_reminder_settings(line_user_id, payload)


@app.get("/user-settings", response_model=UserSettings)
def get_user_settings_endpoint(line_user_id: str = Depends(authenticated_query_line_user)) -> UserSettings:
    return get_user_settings(line_user_id)


@app.put("/user-settings", response_model=UserSettings)
def put_user_settings(payload: UserSettingsUpdate, line_user_id: str = Depends(authenticated_query_line_user)) -> UserSettings:
    return save_user_settings(line_user_id, payload)


@app.post("/daily-reminders/run-due")
def post_run_due_daily_reminders(request: Request) -> dict[str, Any]:
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        raise HTTPException(status_code=503, detail="Cron secret is not configured")
    authorization = request.headers.get("Authorization", "")
    if authorization != f"Bearer {cron_secret}":
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    return _run_due_daily_reminders_and_push()


@app.get("/dashboard")
def dashboard(line_user_id: str = Depends(authenticated_query_line_user)) -> dict:
    transactions = list_transactions(line_user_id=line_user_id)
    return {
        "summary": calculate_summary(transactions),
        "charts": chart_data(transactions),
        "advisor": advisor(transactions),
        "health": financial_health_score(transactions),
    }


@app.post("/what-if")
def what_if(payload: WhatIfScenario, line_user_id: str = Depends(authenticated_query_line_user)) -> dict:
    return simulate_what_if(list_transactions(line_user_id=line_user_id), payload)


@app.post("/line/webhook")
async def line_webhook(request: Request) -> dict[str, Any] | LineWebhookResponse:
    body = await request.body()
    payload = await request.json()
    if "events" in payload:
        channel_secret = os.getenv("LINE_CHANNEL_SECRET")
        allow_unsigned = os.getenv("LINE_WEBHOOK_ALLOW_UNSIGNED", "0") == "1"
        if not channel_secret and not allow_unsigned:
            raise HTTPException(status_code=503, detail="LINE webhook secret is not configured")
        if channel_secret and not verify_line_signature(body, request.headers.get("X-Line-Signature"), channel_secret):
            raise HTTPException(status_code=401, detail="Invalid LINE signature")

        replies = handle_line_events(payload)
        access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
        main_rich_menu_id = os.getenv("LINE_RICH_MENU_MAIN_ID")
        if access_token:
            for reply in replies:
                if reply.get("refresh_main_rich_menu") and main_rich_menu_id:
                    try:
                        link_user_rich_menu(reply["line_user_id"], main_rich_menu_id, access_token)
                    except Exception:
                        logger.exception("Failed to refresh LINE main rich menu for user %s", reply["line_user_id"])
                reply_message = reply.get("line_message") or reply.get("reply")
                if reply.get("reply_token") and reply_message:
                    try:
                        send_line_reply(reply["reply_token"], reply_message, access_token)
                    except Exception:
                        logger.exception("Failed to send LINE reply for user %s", reply["line_user_id"])
        return {"replies": replies, "handled": any(reply["handled"] for reply in replies)}

    if os.getenv("ENABLE_LINE_WEBHOOK_MOCK", "0") != "1":
        raise HTTPException(status_code=404, detail="Not found")
    mock_payload = LineWebhookPayload.model_validate(payload)
    return handle_line_message(mock_payload.line_user_id, mock_payload.message)


@app.post("/users/line", response_model=UserSetup)
def post_line_user(
    payload: LineUserUpsert,
    identity: LineIdentity | None = Depends(require_line_identity),
) -> UserSetup:
    if identity is not None:
        authorize_claimed_line_user(payload.line_user_id, identity)
        payload = LineUserUpsert(
            line_user_id=identity.user_id,
            display_name=identity.display_name,
            picture_url=identity.picture_url,
        )
    return upsert_line_user(payload)


@app.get("/users/line/{line_user_id}/setup", response_model=UserSetup)
def get_line_user_setup(line_user_id: str = Depends(authenticated_path_line_user)) -> UserSetup:
    setup = get_user_setup(line_user_id)
    if setup is None:
        raise HTTPException(status_code=404, detail="LINE user not found")
    return setup


@app.post("/users/line/{line_user_id}/onboarding", response_model=UserSetup)
def post_line_user_onboarding(
    payload: OnboardingPayload,
    line_user_id: str = Depends(authenticated_path_line_user),
    identity: LineIdentity | None = Depends(require_line_identity),
) -> UserSetup:
    if identity is not None and payload.merge_from_line_user_id:
        payload = payload.model_copy(update={"merge_from_line_user_id": None})
    setup = save_user_onboarding(line_user_id, payload)
    if setup is None:
        raise HTTPException(status_code=404, detail="LINE user not found")
    access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    main_rich_menu_id = os.getenv("LINE_RICH_MENU_MAIN_ID")
    if access_token and main_rich_menu_id:
        try:
            link_user_rich_menu(line_user_id, main_rich_menu_id, access_token)
        except Exception:
            logger.exception("Failed to link LINE main rich menu for user %s", line_user_id)
    return setup
