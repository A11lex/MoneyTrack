import re
from datetime import date

from .models import TransactionCreate


class ParseError(ValueError):
    pass


INCOME_KEYWORDS = ("รับ", "ได้เงิน", "เงินเดือน", "รายรับ", "ลูกค้า", "invoice")
BUSINESS_KEYWORDS = ("ลูกค้า", "บริษัท", "ร้าน", "ค่าส่ง", "โฆษณา", "software", "ซอฟต์แวร์", "invoice")

CATEGORY_KEYWORDS: list[tuple[str, tuple[str, ...], str]] = [
    ("Salary", ("เงินเดือน", "salary"), "income"),
    ("Business Revenue", ("ลูกค้า", "invoice", "รายได้ร้าน", "ยอดขาย"), "income"),
    ("Food", ("ข้าว", "กาแฟ", "อาหาร", "ชานม", "ขนม"), "expense"),
    ("Transport", ("น้ำมัน", "taxi", "แท็กซี่", "bts", "รถ", "เดินทาง"), "expense"),
    ("Utilities", ("ไฟ", "น้ำ", "เน็ต", "internet", "ค่าไฟ", "ค่าน้ำ"), "expense"),
    ("Shopping", ("ซื้อของ", "ช้อป", "shopping", "ของใช้"), "expense"),
    ("Debt Payment", ("หนี้", "ผ่อน", "บัตรเครดิต", "loan"), "expense"),
    ("Business Cost", ("โฆษณา", "software", "ซอฟต์แวร์", "ค่าส่ง", "แพ็กของ"), "expense"),
    ("Health", ("ยา", "หมอ", "โรงพยาบาล", "สุขภาพ"), "expense"),
]


def parse_transaction_message(message: str, today: date | None = None) -> TransactionCreate:
    text = " ".join(message.strip().split())
    amount = _extract_amount(text)
    description = _strip_amount(text)
    lowered = description.lower()

    transaction_type = _infer_type(lowered)
    category = _infer_category(lowered, transaction_type)
    mode = _infer_mode(lowered)

    return TransactionCreate(
        date=today or date.today(),
        type=transaction_type,
        amount=amount,
        category=category,
        description=description,
        mode=mode,
    )


def _extract_amount(text: str) -> float:
    matches = re.findall(r"\d[\d,]*(?:\.\d+)?", text)
    if not matches:
        raise ParseError("Message must include an amount.")
    return float(matches[-1].replace(",", ""))


def _strip_amount(text: str) -> str:
    return re.sub(r"\s*\d[\d,]*(?:\.\d+)?\s*$", "", text).strip()


def _infer_type(text: str) -> str:
    if any(keyword in text for keyword in INCOME_KEYWORDS):
        return "income"
    return "expense"


def _infer_category(text: str, transaction_type: str) -> str:
    for category, keywords, category_type in CATEGORY_KEYWORDS:
        if category_type == transaction_type and any(keyword in text for keyword in keywords):
            return category
    return "Other Income" if transaction_type == "income" else "Other Expense"


def _infer_mode(text: str) -> str:
    if any(keyword in text for keyword in BUSINESS_KEYWORDS):
        return "business"
    return "personal"
