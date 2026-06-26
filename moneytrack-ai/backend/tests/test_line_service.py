from datetime import date

from app.database import list_transactions
from app.line_service import handle_line_message, handle_line_message_detail


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


def test_handle_line_message_detail_returns_daily_summary_flex(tmp_path) -> None:
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
