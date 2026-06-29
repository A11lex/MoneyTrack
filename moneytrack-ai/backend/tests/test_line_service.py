from datetime import date
from typing import Any

from app.database import get_user_setup, list_transactions, save_user_onboarding, save_user_settings, update_transaction, upsert_line_user
from app.line_service import handle_line_message, handle_line_message_detail
from app.models import LineUserUpsert, OnboardingPayload, TransactionUpdate, UserSettingsUpdate


def test_handle_line_message_saves_transaction_and_returns_reply(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")

    result = handle_line_message(
        line_user_id="test-user-001",
        message="ข้าว 80",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    transactions = list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].type == "expense"
    assert transactions[0].amount == 80
    assert transactions[0].category == "Food"
    assert transactions[0].mode == "personal"
    assert result.reply == "บันทึกแล้ว: รายจ่าย 80 บาท\nหมวด: Food\nโหมด: ส่วนตัว"


def test_line_transactions_are_scoped_by_user(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")

    handle_line_message("user-a", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("user-b", "ข้าว 120", db_path=db_path, today=date(2026, 6, 25))

    user_a_transactions = list_transactions(db_path, line_user_id="user-a")
    user_b_transactions = list_transactions(db_path, line_user_id="user-b")

    assert [transaction.amount for transaction in user_a_transactions] == [80]
    assert [transaction.amount for transaction in user_b_transactions] == [120]
    assert len(list_transactions(db_path)) == 2


def test_line_message_creates_line_user_setup_row(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")

    handle_line_message("line-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))

    setup = get_user_setup("line-user-001", db_path)
    assert setup is not None
    assert setup.line_user_id == "line-user-001"
    assert setup.onboarding_completed is False


def test_handle_line_message_returns_parse_error_without_saving(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")

    result = handle_line_message(
        line_user_id="test-user-001",
        message="ข้าวกลางวัน",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert list_transactions(db_path) == []
    assert result.reply == "ยังบันทึกไม่ได้: กรุณาระบุจำนวนเงิน เช่น ข้าว 80"


def test_handle_line_message_returns_daily_summary(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "รับเงินลูกค้า 2500", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("test-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))

    result = handle_line_message(
        line_user_id="test-user-001",
        message="สรุปวันนี้",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.reply == "สรุปวันนี้\nรายรับ: 2,500 บาท\nรายจ่าย: 80 บาท\nสุทธิ: +2,420 บาท"


def test_handle_line_message_detail_returns_daily_summary_flex_with_category_rows(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "รับเงินลูกค้า 2500", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("test-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="สรุปวันนี้",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.line_message is not None
    assert result.line_message["type"] == "flex"
    assert result.line_message["altText"] == "สรุปวันนี้: สุทธิ +2,420 บาท"
    assert _find_text(result.line_message, "อาหาร") is True
    assert _buttons(result.line_message)[0]["action"]["uri"].endswith("/liff/summary")


def test_handle_line_message_detail_returns_monthly_summary_flex(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "เงินเดือน 41000", db_path=db_path, today=date(2026, 6, 1))
    handle_line_message("test-user-001", "ข้าว 740", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("test-user-001", "น้ำมัน 425", db_path=db_path, today=date(2026, 6, 26))
    handle_line_message("test-user-001", "ข้าว 999", db_path=db_path, today=date(2026, 5, 26))

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="สรุปประจำเดือน",
        db_path=db_path,
        today=date(2026, 6, 27),
    )

    assert result.line_message is not None
    assert result.line_message["type"] == "flex"
    assert result.line_message["altText"] == "รายงานประจำเดือน: คงเหลือ +39,835 บาท"
    assert _find_text(result.line_message, "รายรับทั้งหมด") is True
    assert _find_text(result.line_message, "ใช้ไปทั้งหมด") is True
    assert _find_text(result.line_message, "฿999") is False


def test_handle_line_message_detail_returns_quick_start_flex_for_help() -> None:
    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="วิธีใช้",
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.line_message is not None
    assert result.line_message["altText"] == "เริ่มจดรายรับรายจ่ายกับ เงินไปไหน?"
    assert _buttons(result.line_message)[0]["action"] == {
        "type": "postback",
        "label": "จดเลย",
        "data": "open_record_keyboard",
        "inputOption": "openKeyboard",
    }


def test_handle_line_message_detail_returns_category_budget_flex() -> None:
    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="หมวด/งบ",
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.line_message is not None
    assert result.line_message["altText"] == "จัดการหมวดและงบใน เงินไปไหน?"
    assert _buttons(result.line_message)[0]["action"]["uri"].endswith("/liff/categories")


def test_handle_line_message_detail_returns_budget_alert_when_category_budget_is_exceeded(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_onboarding(
        "test-user-001",
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["อาหาร", "เดินทาง"],
            income_categories=["เงินเดือน"],
            monthly_budgets={"อาหาร": 100},
        ),
        db_path,
    )

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="ข้าว 180",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.line_message is not None
    assert isinstance(result.line_message, dict)
    assert result.line_message["altText"] == "จดสำเร็จและงบคงเหลือ: แจ้งเตือนงบ: อาหาร ใช้ไป ฿180 / ฿100"
    assert _find_text(result.line_message, "จดสำเร็จ") is True
    assert _find_text(result.line_message, "งบคงเหลือ") is True
    assert _find_text(result.line_message, "ข้อความเตือนงบประมาณ") is False
    assert _find_text(result.line_message, "ใช้จ่ายหมวดอาหารเต็มงบแล้วนะ") is True


def test_handle_line_message_detail_returns_budget_progress_before_half_of_budget(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_onboarding(
        "test-user-001",
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["อาหาร"],
            income_categories=[],
            monthly_budgets={"อาหาร": 200},
        ),
        db_path,
    )

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="ข้าว 50",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.line_message is not None
    assert isinstance(result.line_message, dict)
    assert result.line_message["altText"] == "จดสำเร็จและงบคงเหลือ: งบคงเหลือ: อาหาร ใช้ไป ฿50 / ฿200"
    assert _find_text(result.line_message, "จดสำเร็จ") is True
    assert _find_text(result.line_message, "งบคงเหลือ") is True
    assert _find_text(result.line_message, "฿50 / ฿200") is True
    assert _find_text(result.line_message, "ใช้จ่ายหมวดอาหารจะเกินงบแล้วนะ") is False


def test_handle_line_message_detail_returns_budget_progress_at_half_without_warning(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_onboarding(
        "test-user-001",
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["อาหาร"],
            income_categories=[],
            monthly_budgets={"อาหาร": 200},
        ),
        db_path,
    )

    handle_line_message_detail(
        line_user_id="test-user-001",
        message="ข้าว 50",
        db_path=db_path,
        today=date(2026, 6, 25),
    )
    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="ข้าว 50",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.line_message is not None
    assert isinstance(result.line_message, dict)
    assert result.line_message["altText"] == "จดสำเร็จและงบคงเหลือ: งบคงเหลือ: อาหาร ใช้ไป ฿100 / ฿200"
    assert _find_text(result.line_message, "จดสำเร็จ") is True
    assert _find_text(result.line_message, "งบคงเหลือ") is True
    assert _find_text(result.line_message, "ข้อความเตือนงบประมาณ") is False


def test_memory_categorization_learns_from_edited_category(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_settings(
        "test-user-001",
        UserSettingsUpdate(memory_categorization_enabled=True),
        db_path,
    )

    first = handle_line_message_detail(
        line_user_id="test-user-001",
        message="latte 50",
        db_path=db_path,
        today=date(2026, 6, 25),
    )
    first_transaction = list_transactions(db_path, line_user_id="test-user-001")[0]
    assert first_transaction.category == "Other Expense"
    update_transaction(
        first_transaction.id,
        TransactionUpdate(
            date=first_transaction.date,
            type=first_transaction.type,
            amount=first_transaction.amount,
            category="Food",
            description=first_transaction.description,
            mode=first_transaction.mode,
        ),
        db_path,
        line_user_id="test-user-001",
    )

    second = handle_line_message_detail(
        line_user_id="test-user-001",
        message="latte iced 60",
        db_path=db_path,
        today=date(2026, 6, 26),
    )
    second_transaction = list_transactions(db_path, line_user_id="test-user-001")[0]

    assert first.handled is True
    assert second.handled is True
    assert second_transaction.category == "Food"


def test_streak_notification_adds_second_flex_when_enabled(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_settings(
        "test-user-001",
        UserSettingsUpdate(streak_notifications_enabled=True),
        db_path,
    )
    handle_line_message_detail("test-user-001", "ข้าว 50", db_path=db_path, today=date(2026, 6, 25))

    result = handle_line_message_detail("test-user-001", "ข้าว 60", db_path=db_path, today=date(2026, 6, 26))

    assert isinstance(result.line_message, list)
    assert len(result.line_message) == 2
    assert result.line_message[1]["altText"] == "จดต่อเนื่องมา 2 วัน"


def test_confirmation_config_can_hide_budget_block(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_onboarding(
        "test-user-001",
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["อาหาร"],
            income_categories=[],
            monthly_budgets={"อาหาร": 200},
        ),
        db_path,
    )
    save_user_settings(
        "test-user-001",
        UserSettingsUpdate(confirmation_show_budget=False),
        db_path,
    )

    result = handle_line_message_detail("test-user-001", "ข้าว 50", db_path=db_path, today=date(2026, 6, 25))

    assert isinstance(result.line_message, dict)
    assert _find_text(result.line_message, "งบคงเหลือ") is False


def test_confirmation_config_shows_payment_channels(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_settings(
        "test-user-001",
        UserSettingsUpdate(
            confirmation_show_payment_options=True,
            payment_channels=["เงินสด", "พร้อมเพย์"],
        ),
        db_path,
    )

    result = handle_line_message_detail("test-user-001", "ข้าว 50", db_path=db_path, today=date(2026, 6, 25))

    assert isinstance(result.line_message, dict)
    assert _find_text(result.line_message, "ช่องทางชำระเงิน") is True
    assert _find_text(result.line_message, "เงินสด") is True
    assert _find_text(result.line_message, "พร้อมเพย์") is True


def test_handle_line_message_detail_uses_custom_monthly_budget_start_day(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_onboarding(
        "test-user-001",
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["อาหาร"],
            income_categories=[],
            monthly_budgets={"อาหาร": 200},
            budget_cycle="monthly",
            budget_start_day=15,
        ),
        db_path,
    )

    handle_line_message_detail(
        line_user_id="test-user-001",
        message="ข้าว 90",
        db_path=db_path,
        today=date(2026, 6, 14),
    )
    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="ข้าว 10",
        db_path=db_path,
        today=date(2026, 6, 15),
    )

    assert result.line_message is not None
    assert isinstance(result.line_message, dict)
    assert result.line_message["altText"] == "จดสำเร็จและงบคงเหลือ: งบคงเหลือ: อาหาร ใช้ไป ฿10 / ฿200"
    assert _find_text(result.line_message, "รอบงบ: รายเดือน (วันที่ 15)") is True


def test_handle_line_message_detail_deletes_transaction_by_button_command(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))
    transaction_id = list_transactions(db_path)[0].id

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message=f"ลบรายการ {transaction_id}",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.reply == "ลบแล้ว: 80 บาท"
    assert list_transactions(db_path) == []
    assert result.line_message is not None
    assert result.line_message["altText"] == "ลบสำเร็จ: รายจ่าย 80 บาท"


def test_line_user_cannot_delete_another_users_transaction(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("user-a", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))
    transaction_id = list_transactions(db_path, line_user_id="user-a")[0].id

    result = handle_line_message_detail(
        line_user_id="user-b",
        message=f"ลบรายการ {transaction_id}",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.handled is False
    assert [transaction.id for transaction in list_transactions(db_path, line_user_id="user-a")] == [transaction_id]
    assert list_transactions(db_path, line_user_id="user-b") == []


def test_handle_line_message_detail_deletes_transaction_and_returns_budget_progress(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    upsert_line_user(LineUserUpsert(line_user_id="test-user-001", display_name="Tester"), db_path)
    save_user_onboarding(
        "test-user-001",
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["อาหาร"],
            income_categories=[],
            monthly_budgets={"อาหาร": 200},
        ),
        db_path,
    )
    handle_line_message("test-user-001", "ข้าว 50", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("test-user-001", "ข้าว 10", db_path=db_path, today=date(2026, 6, 25))
    transaction_id = next(transaction.id for transaction in list_transactions(db_path) if transaction.amount == 10)

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message=f"ลบรายการ {transaction_id}",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.line_message is not None
    assert result.line_message["altText"] == "ลบสำเร็จและงบคงเหลือ: งบคงเหลือ: อาหาร ใช้ไป ฿50 / ฿200"
    assert _find_text(result.line_message, "ลบสำเร็จ ×") is True
    assert _find_text(result.line_message, "งบคงเหลือ") is True
    assert _find_text(result.line_message, "฿50 / ฿200") is True


def _buttons(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if value.get("type") == "button":
            found.append(value)
        for child in value.values():
            found.extend(_buttons(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_buttons(child))
    return found


def _find_text(value: Any, text: str) -> bool:
    if isinstance(value, dict):
        if value.get("type") == "text" and text in value.get("text", ""):
            return True
        return any(_find_text(child, text) for child in value.values())
    if isinstance(value, list):
        return any(_find_text(child, text) for child in value)
    return False
