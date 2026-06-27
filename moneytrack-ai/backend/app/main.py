import os
import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import (
    create_transaction,
    delete_transaction,
    get_transaction,
    get_user_setup,
    list_transactions,
    save_user_onboarding,
    seed_demo_data,
    update_transaction,
    upsert_line_user,
)
from .finance import advisor, calculate_summary, chart_data, financial_health_score, simulate_what_if
from .line_adapter import handle_line_events
from .line_client import link_user_rich_menu, send_line_reply
from .line_security import verify_line_signature
from .line_service import LineWebhookPayload, LineWebhookResponse, handle_line_message
from .models import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    LineUserUpsert,
    OnboardingPayload,
    Transaction,
    TransactionCreate,
    TransactionUpdate,
    UserSetup,
    WhatIfScenario,
)

app = FastAPI(title="MoneyTrack AI API", version="0.1.0")
logger = logging.getLogger(__name__)

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
def startup() -> None:
    seed_demo_data()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/categories")
def categories() -> dict:
    return {"income": INCOME_CATEGORIES, "expense": EXPENSE_CATEGORIES}


@app.get("/transactions", response_model=list[Transaction])
def get_transactions(line_user_id: str | None = None) -> list[Transaction]:
    return list_transactions(line_user_id=line_user_id)


@app.get("/transactions/{transaction_id}", response_model=Transaction)
def get_transaction_by_id(transaction_id: int, line_user_id: str | None = None) -> Transaction:
    transaction = get_transaction(transaction_id, line_user_id=line_user_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@app.post("/transactions", response_model=Transaction, status_code=201)
def post_transaction(payload: TransactionCreate, line_user_id: str | None = None) -> Transaction:
    return create_transaction(payload, line_user_id=line_user_id)


@app.put("/transactions/{transaction_id}", response_model=Transaction)
def put_transaction(transaction_id: int, payload: TransactionUpdate, line_user_id: str | None = None) -> Transaction:
    transaction = update_transaction(transaction_id, payload, line_user_id=line_user_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@app.delete("/transactions/{transaction_id}", status_code=204)
def remove_transaction(transaction_id: int, line_user_id: str | None = None) -> None:
    deleted = delete_transaction(transaction_id, line_user_id=line_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")


@app.get("/dashboard")
def dashboard(line_user_id: str | None = None) -> dict:
    transactions = list_transactions(line_user_id=line_user_id)
    return {
        "summary": calculate_summary(transactions),
        "charts": chart_data(transactions),
        "advisor": advisor(transactions),
        "health": financial_health_score(transactions),
    }


@app.post("/what-if")
def what_if(payload: WhatIfScenario, line_user_id: str | None = None) -> dict:
    return simulate_what_if(list_transactions(line_user_id=line_user_id), payload)


@app.post("/line/webhook")
async def line_webhook(request: Request) -> dict[str, Any] | LineWebhookResponse:
    body = await request.body()
    payload = await request.json()
    if "events" in payload:
        channel_secret = os.getenv("LINE_CHANNEL_SECRET")
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
                    send_line_reply(reply["reply_token"], reply_message, access_token)
        return {"replies": replies, "handled": any(reply["handled"] for reply in replies)}

    mock_payload = LineWebhookPayload.model_validate(payload)
    return handle_line_message(mock_payload.line_user_id, mock_payload.message)


@app.post("/users/line", response_model=UserSetup)
def post_line_user(payload: LineUserUpsert) -> UserSetup:
    return upsert_line_user(payload)


@app.get("/users/line/{line_user_id}/setup", response_model=UserSetup)
def get_line_user_setup(line_user_id: str) -> UserSetup:
    setup = get_user_setup(line_user_id)
    if setup is None:
        raise HTTPException(status_code=404, detail="LINE user not found")
    return setup


@app.post("/users/line/{line_user_id}/onboarding", response_model=UserSetup)
def post_line_user_onboarding(line_user_id: str, payload: OnboardingPayload) -> UserSetup:
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
