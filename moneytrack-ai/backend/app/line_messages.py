from datetime import date
from typing import Any

BRAND = {
    "yellow": "#FFC928",
    "red": "#E60012",
    "black": "#111111",
    "cream": "#FFF3D6",
    "brown": "#7A4A1F",
    "green": "#7FB069",
    "pink": "#F04FA3",
    "white": "#FFFFFF",
}


def build_transaction_success_flex(
    transaction_type: str,
    amount: float,
    category: str,
    description: str,
    mode: str,
    transaction_date: date,
) -> dict[str, Any]:
    type_label = "รายรับ" if transaction_type == "income" else "รายจ่าย"
    mode_label = "ธุรกิจ" if mode == "business" else "ส่วนตัว"
    amount_color = BRAND["green"] if transaction_type == "income" else BRAND["red"]
    amount_text = f"฿{amount:,.0f}"

    return {
        "type": "flex",
        "altText": f"จดสำเร็จ: {type_label} {amount:,.0f} บาท",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": {
                "body": {"backgroundColor": BRAND["cream"]},
                "footer": {"backgroundColor": BRAND["cream"]},
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "contents": [
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "alignItems": "center",
                        "contents": [
                            {
                                "type": "text",
                                "text": "จดสำเร็จ",
                                "weight": "bold",
                                "size": "xl",
                                "color": BRAND["black"],
                                "flex": 1,
                            },
                            {
                                "type": "text",
                                "text": "✅",
                                "size": "xl",
                                "align": "end",
                            },
                        ],
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": f"{type_label} · {_category_label(category)}",
                                        "size": "sm",
                                        "weight": "bold",
                                        "color": BRAND["brown"],
                                    },
                                    {
                                        "type": "text",
                                        "text": description or "-",
                                        "size": "lg",
                                        "weight": "bold",
                                        "color": BRAND["black"],
                                        "wrap": True,
                                        "margin": "sm",
                                    },
                                ],
                                "flex": 1,
                            },
                            {
                                "type": "text",
                                "text": amount_text,
                                "size": "xxl",
                                "weight": "bold",
                                "color": amount_color,
                                "align": "end",
                                "gravity": "center",
                            },
                        ],
                    },
                    {
                        "type": "separator",
                        "color": BRAND["yellow"],
                        "margin": "md",
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "xs",
                        "contents": [
                            _meta_row("วันที่", _format_thai_date(transaction_date)),
                            _meta_row("โหมด", mode_label),
                            _meta_row("แบรนด์", "เงินไปไหน?"),
                        ],
                    },
                ],
            },
            "footer": {
                "type": "box",
                "layout": "horizontal",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "height": "sm",
                        "color": BRAND["pink"],
                        "action": {"type": "message", "label": "แก้ไข", "text": "แก้ไขรายการล่าสุด"},
                    },
                    {
                        "type": "button",
                        "style": "secondary",
                        "height": "sm",
                        "color": BRAND["white"],
                        "action": {"type": "message", "label": "ลบ", "text": "ลบรายการล่าสุด"},
                    },
                ],
            },
        },
    }


def _meta_row(label: str, value: str) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            {"type": "text", "text": label, "size": "xs", "color": BRAND["brown"], "flex": 1},
            {"type": "text", "text": value, "size": "xs", "color": BRAND["black"], "align": "end", "flex": 2},
        ],
    }


def _format_thai_date(value: date) -> str:
    return f"{value.day} มิ.ย. {value.year + 543}" if value.month == 6 else f"{value.day}/{value.month}/{value.year + 543}"


def _category_label(category: str) -> str:
    labels = {
        "Food": "อาหาร",
        "Transport": "เดินทาง",
        "Shopping": "ช้อปปิ้ง",
        "Utilities": "บิล",
        "Salary": "เงินเดือน",
        "Business Revenue": "รายรับธุรกิจ",
        "Business Cost": "ต้นทุนธุรกิจ",
        "Debt Payment": "หนี้",
        "Health": "สุขภาพ",
    }
    return labels.get(category, category)
