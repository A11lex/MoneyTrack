from datetime import date

from app.line_messages import build_transaction_success_flex


def test_build_transaction_success_flex_matches_brand_ci_for_expense() -> None:
    message = build_transaction_success_flex(
        transaction_type="expense",
        amount=346,
        category="Food",
        description="ข้าว",
        mode="personal",
        transaction_date=date(2026, 6, 26),
    )

    assert message["type"] == "flex"
    assert message["altText"] == "จดสำเร็จ: รายจ่าย 346 บาท"
    assert message["contents"]["styles"]["body"]["backgroundColor"] == "#FFF3D6"
    assert message["contents"]["body"]["contents"][0]["contents"][0]["text"] == "จดสำเร็จ"
    assert message["contents"]["body"]["contents"][1]["contents"][1]["text"] == "฿346"
    assert message["contents"]["body"]["contents"][1]["contents"][1]["color"] == "#E60012"
    assert message["contents"]["footer"]["contents"][0]["style"] == "primary"


def test_build_transaction_success_flex_uses_green_amount_for_income() -> None:
    message = build_transaction_success_flex(
        transaction_type="income",
        amount=2500,
        category="Business Revenue",
        description="รับเงินลูกค้า",
        mode="business",
        transaction_date=date(2026, 6, 26),
    )

    assert message["altText"] == "จดสำเร็จ: รายรับ 2,500 บาท"
    assert message["contents"]["body"]["contents"][1]["contents"][1]["color"] == "#7FB069"
