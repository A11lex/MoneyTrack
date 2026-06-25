from datetime import date

import pytest

from app.message_parser import ParseError, parse_transaction_message


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        (
            "ข้าว 80",
            {
                "type": "expense",
                "amount": 80,
                "category": "Food",
                "description": "ข้าว",
                "mode": "personal",
            },
        ),
        (
            "กาแฟ 65",
            {
                "type": "expense",
                "amount": 65,
                "category": "Food",
                "description": "กาแฟ",
                "mode": "personal",
            },
        ),
        (
            "รับเงินเดือน 30000",
            {
                "type": "income",
                "amount": 30000,
                "category": "Salary",
                "description": "รับเงินเดือน",
                "mode": "personal",
            },
        ),
        (
            "รับเงินลูกค้า 2500",
            {
                "type": "income",
                "amount": 2500,
                "category": "Business Revenue",
                "description": "รับเงินลูกค้า",
                "mode": "business",
            },
        ),
        (
            "ค่าน้ำมันบริษัท 1200",
            {
                "type": "expense",
                "amount": 1200,
                "category": "Transport",
                "description": "ค่าน้ำมันบริษัท",
                "mode": "business",
            },
        ),
        (
            "ซื้อของ 500",
            {
                "type": "expense",
                "amount": 500,
                "category": "Shopping",
                "description": "ซื้อของ",
                "mode": "personal",
            },
        ),
        (
            "ค่าไฟ 900",
            {
                "type": "expense",
                "amount": 900,
                "category": "Utilities",
                "description": "ค่าไฟ",
                "mode": "personal",
            },
        ),
    ],
)
def test_parse_transaction_message_maps_natural_thai_text(message: str, expected: dict) -> None:
    parsed = parse_transaction_message(message, today=date(2026, 6, 25))

    assert parsed.model_dump() == {
        "date": date(2026, 6, 25),
        **expected,
    }


def test_parse_transaction_message_supports_comma_amounts() -> None:
    parsed = parse_transaction_message("รับเงินลูกค้า 12,500", today=date(2026, 6, 25))

    assert parsed.amount == 12500
    assert parsed.type == "income"
    assert parsed.category == "Business Revenue"
    assert parsed.mode == "business"


def test_parse_transaction_message_rejects_text_without_amount() -> None:
    with pytest.raises(ParseError, match="amount"):
        parse_transaction_message("ข้าวกลางวัน", today=date(2026, 6, 25))
