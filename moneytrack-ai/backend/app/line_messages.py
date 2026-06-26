import os
from datetime import date
from typing import Any

BRAND = {
    "green": "#6DC5AD",
    "dark_green": "#0D4A2B",
    "yellow": "#FFD335",
    "pink": "#DC143C",
    "soft_pink": "#FCECEF",
    "soft_green": "#EAF8F4",
    "cream": "#FFF8E4",
    "surface": "#FFFFFF",
    "muted": "#6B7280",
    "line": "#E5E7EB",
    "black": "#111111",
}

DEFAULT_FRONTEND_ORIGIN = "https://money-track-sandy.vercel.app"


def build_quick_start_flex() -> dict[str, Any]:
    return {
        "type": "flex",
        "altText": "เริ่มจดรายรับรายจ่ายกับ เงินไปไหน?",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": _bubble_styles(),
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "lg",
                "paddingAll": "20px",
                "contents": [
                    _brand_header("เงินไปไหน?", "พิมพ์บอกได้เลย เราจะช่วยจัดหมวดให้อัตโนมัติ"),
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "sm",
                        "contents": [
                            _plain_text("เช่น", "sm", BRAND["muted"]),
                            _plain_text("- ข้าวมันไก่ 50", "md", BRAND["black"]),
                            _plain_text("- เงินเดือน 20000", "md", BRAND["black"]),
                            _plain_text("- ค่าน้ำมันบริษัท 1200", "md", BRAND["black"]),
                        ],
                    },
                    _plain_text("พิมพ์รายการในแชทได้ทันที ระบบจะช่วยแยกหมวดให้เอง", "sm", BRAND["muted"]),
                ],
            },
            "footer": _single_keyboard_footer("จดเลย", BRAND["green"]),
        },
    }


def build_category_budget_flex() -> dict[str, Any]:
    return {
        "type": "flex",
        "altText": "จัดการหมวดและงบใน เงินไปไหน?",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": _bubble_styles(),
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "lg",
                "paddingAll": "20px",
                "contents": [
                    _brand_header("จัดการหมวดและงบ", "ตั้งหมวดรายรับรายจ่าย และกำหนดงบที่อยากคุม"),
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "sm",
                        "backgroundColor": BRAND["soft_green"],
                        "cornerRadius": "md",
                        "paddingAll": "14px",
                        "contents": [
                            _plain_text("ทำได้ในหน้าแอป", "sm", BRAND["dark_green"], weight="bold"),
                            _plain_text("• เพิ่มหมวดใหม่", "sm", BRAND["black"]),
                            _plain_text("• แก้ไขหรือลบหมวด", "sm", BRAND["black"]),
                            _plain_text("• ตั้งงบรายวัน รายสัปดาห์ รายเดือน", "sm", BRAND["black"]),
                            _plain_text("• ดูว่าหมวดไหนใช้เกินงบ", "sm", BRAND["black"]),
                        ],
                    },
                ],
            },
            "footer": _single_uri_footer("เข้าจัดการหมวดและงบ", "/liff/categories", BRAND["green"]),
        },
    }


def build_transaction_success_flex(
    transaction_id: int,
    transaction_type: str,
    amount: float,
    category: str,
    description: str,
    mode: str,
    transaction_date: date,
) -> dict[str, Any]:
    type_label = "รายรับ" if transaction_type == "income" else "รายจ่าย"
    mode_label = "ธุรกิจ" if mode == "business" else "ส่วนตัว"
    amount_color = BRAND["green"] if transaction_type == "income" else BRAND["pink"]
    accent_bg = BRAND["soft_green"] if transaction_type == "income" else BRAND["soft_pink"]
    amount_text = f"฿{amount:,.0f}"
    category_text = _category_label(category)

    return {
        "type": "flex",
        "altText": f"จดสำเร็จ: {type_label} {amount:,.0f} บาท",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": _bubble_styles(),
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "paddingAll": "20px",
                "contents": [
                    _brand_header("จดสำเร็จ", "ตรวจสอบรายการที่จดไว้ ถ้าหมวดไม่ถูกให้แก้ในหน้าแอปได้เลย"),
                    _pill(f"{type_label} - {category_text}", amount_color, "#FFFFFF"),
                    _plain_text(_format_thai_datetime(transaction_date), "xs", BRAND["muted"]),
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "spacing": "sm",
                        "contents": [
                            _plain_text(description or "-", "lg", BRAND["black"], weight="bold", wrap=True),
                            _plain_text(amount_text, "xl", amount_color, weight="bold", align="end"),
                            _icon_action("✎", "uri", _frontend_url(f"/liff/transactions/{transaction_id}/edit"), "#EFF4F8"),
                            _icon_action("×", "postback", f"delete_transaction={transaction_id}", "#EFF4F8", BRAND["pink"]),
                        ],
                    },
                    {"type": "separator", "color": BRAND["black"], "margin": "md"},
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "sm",
                        "backgroundColor": accent_bg,
                        "cornerRadius": "md",
                        "paddingAll": "14px",
                        "contents": [
                            _amount_row(category_text, amount, amount_color),
                            _meta_row("โหมด", mode_label),
                        ],
                    },
                    _plain_text("กด ✎ เพื่อแก้ไข หรือ × เพื่อลบรายการนี้", "xs", BRAND["muted"]),
                ],
            },
        },
    }


def build_transaction_deleted_flex(
    transaction_type: str,
    amount: float,
    category: str,
    description: str,
    transaction_date: date,
) -> dict[str, Any]:
    type_label = "รายรับ" if transaction_type == "income" else "รายจ่าย"
    amount_color = BRAND["green"] if transaction_type == "income" else BRAND["pink"]
    category_text = _category_label(category)
    return {
        "type": "flex",
        "altText": f"ลบสำเร็จ: {type_label} {amount:,.0f} บาท",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": _bubble_styles(),
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "paddingAll": "20px",
                "contents": [
                    _brand_header("ลบสำเร็จ ×", "รายการถูกลบเรียบร้อยแล้ว"),
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "vertical",
                                "spacing": "sm",
                                "contents": [
                                    _pill(f"{type_label} - {category_text}", amount_color, "#FFFFFF"),
                                    _plain_text(_format_thai_datetime(transaction_date), "xs", BRAND["muted"]),
                                    _plain_text(description or "-", "lg", BRAND["black"], weight="bold"),
                                ],
                                "flex": 1,
                            },
                            _plain_text(f"฿{amount:,.0f}", "lg", amount_color, weight="bold", align="end"),
                        ],
                    },
                ],
            },
        },
    }


def build_daily_summary_flex(
    summary_date: date,
    income: float,
    expense: float,
    net: float,
    category_totals: dict[str, float] | None = None,
) -> dict[str, Any]:
    net_color = BRAND["green"] if net >= 0 else BRAND["pink"]
    net_text = f"{'+' if net >= 0 else '-'}฿{abs(net):,.0f}"
    category_rows = _category_summary_rows(category_totals or {})

    return {
        "type": "flex",
        "altText": f"สรุปวันนี้: สุทธิ {'+' if net >= 0 else '-'}{abs(net):,.0f} บาท",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": _bubble_styles(),
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "lg",
                "paddingAll": "20px",
                "contents": [
                    _brand_header("สรุปวันนี้", f"วันที่ {_format_thai_date(summary_date)}"),
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "sm",
                        "backgroundColor": BRAND["soft_green"] if net >= 0 else BRAND["soft_pink"],
                        "cornerRadius": "md",
                        "paddingAll": "14px",
                        "contents": [
                            _amount_row("รายรับ", income, BRAND["green"]),
                            _amount_row("รายจ่าย", expense, BRAND["pink"]),
                            {"type": "separator", "color": BRAND["line"], "margin": "sm"},
                            _amount_row("คงเหลือวันนี้", net, net_color, signed=True),
                        ],
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "sm",
                        "contents": [
                            _plain_text("ใช้ไปตามหมวด", "md", BRAND["black"], weight="bold"),
                            *category_rows,
                            _amount_row("ใช้ไปทั้งหมด", expense, BRAND["black"]),
                        ],
                    },
                ],
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "paddingAll": "16px",
                "contents": [
                    _uri_button("ดูสรุปย้อนหลัง", "/liff/summary", BRAND["green"], "primary"),
                    _uri_button("วิเคราะห์ต่อ", "/liff/insights", BRAND["dark_green"], "secondary"),
                ],
            },
        },
    }


def build_budget_alert_flex(
    *,
    budget_limit: float,
    category: str,
    period_label: str,
    spent: float,
    total_income: float,
) -> dict[str, Any]:
    category_text = _category_label(category)
    remaining = max(budget_limit - spent, 0)
    usage_percent = 0 if budget_limit <= 0 else min((spent / budget_limit) * 100, 100)
    warning = (
        f"ใช้จ่ายหมวด{category_text}เต็มงบแล้วนะ"
        if spent >= budget_limit and budget_limit > 0
        else f"ใช้จ่ายหมวด{category_text}ใกล้เต็มงบแล้วนะ"
    )

    return {
        "type": "flex",
        "altText": f"แจ้งเตือนงบ: {category_text} ใช้ไป ฿{spent:,.0f} / ฿{budget_limit:,.0f}",
        "contents": {
            "type": "bubble",
            "size": "mega",
            "styles": _bubble_styles(),
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "paddingAll": "16px",
                "contents": [
                    _budget_panel(
                        "งบคงเหลือ",
                        [
                            {"type": "separator", "color": BRAND["muted"], "margin": "lg"},
                            _budget_progress_row("รายได้", total_income, total_income, BRAND["green"]),
                            _budget_progress_row(category_text, spent, budget_limit, BRAND["pink"], suffix=f" / ฿{budget_limit:,.0f}"),
                            _plain_text(f"รอบงบ: {period_label}", "xs", BRAND["muted"], align="end"),
                            _plain_text(f"เหลืองบอีก ฿{remaining:,.0f} ({usage_percent:.0f}% ใช้ไปแล้ว)", "xs", BRAND["muted"], align="end"),
                        ],
                    ),
                    _budget_panel(
                        "ข้อความเตือนงบประมาณ",
                        [
                            _plain_text(f"👵 {warning}", "sm", BRAND["black"], wrap=True),
                        ],
                    ),
                ],
            },
            "footer": _single_uri_footer("ตั้งค่างบ", "/liff/categories", BRAND["green"]),
        },
    }


def _bubble_styles() -> dict[str, Any]:
    return {
        "body": {"backgroundColor": BRAND["surface"]},
        "footer": {"backgroundColor": BRAND["surface"]},
    }


def _brand_header(title: str, subtitle: str) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "vertical",
        "spacing": "sm",
        "contents": [
            _plain_text(title, "xl", BRAND["black"], weight="bold"),
            _plain_text(subtitle, "sm", BRAND["muted"], wrap=True),
            {
                "type": "separator",
                "color": BRAND["green"],
                "margin": "md",
            },
        ],
    }


def _single_uri_footer(label: str, path: str, color: str) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "16px",
        "contents": [_uri_button(label, path, color, "primary")],
    }


def _single_keyboard_footer(label: str, color: str) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "16px",
        "contents": [_keyboard_button(label, color)],
    }


def _uri_button(label: str, path: str, color: str, style: str) -> dict[str, Any]:
    return {
        "type": "button",
        "style": style,
        "height": "sm",
        "color": color,
        "action": {
            "type": "uri",
            "label": label,
            "uri": _frontend_url(path),
        },
    }


def _keyboard_button(label: str, color: str) -> dict[str, Any]:
    return {
        "type": "button",
        "style": "primary",
        "height": "sm",
        "color": color,
        "action": {
            "type": "postback",
            "label": label,
            "data": "open_record_keyboard",
            "inputOption": "openKeyboard",
        },
    }


def _icon_action(
    label: str,
    action_type: str,
    target: str,
    background_color: str,
    text_color: str = BRAND["black"],
) -> dict[str, Any]:
    action = {"type": action_type, "label": label}
    if action_type == "uri":
        action["uri"] = target
    elif action_type == "postback":
        action["data"] = target
    else:
        action["text"] = target
    return {
        "type": "button",
        "style": "primary" if label == "×" else "secondary",
        "height": "sm",
        "color": text_color if label == "×" else background_color,
        "action": action,
        "flex": 0,
    }


def _frontend_url(path: str) -> str:
    origin = os.getenv("LIFF_APP_BASE_URL") or os.getenv("FRONTEND_ORIGIN") or DEFAULT_FRONTEND_ORIGIN
    return f"{origin.rstrip('/')}/{path.lstrip('/')}"


def _plain_text(
    text: str,
    size: str,
    color: str,
    *,
    weight: str = "regular",
    align: str = "start",
    wrap: bool = False,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "text",
        "text": text,
        "size": size,
        "color": color,
        "align": align,
        "weight": weight,
    }
    if wrap:
        payload["wrap"] = True
    return payload


def _pill(text: str, background_color: str, text_color: str) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "horizontal",
        "width": "120px",
        "backgroundColor": background_color,
        "cornerRadius": "xxl",
        "paddingAll": "6px",
        "contents": [
            _plain_text(text, "xs", text_color, weight="bold", align="center", wrap=True),
        ],
    }


def _amount_row(label: str, amount: float, color: str, *, signed: bool = False) -> dict[str, Any]:
    text = _format_signed_baht(amount) if signed else f"฿{amount:,.0f}"
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            _plain_text(label, "sm", BRAND["black"], weight="bold", wrap=True),
            {
                "type": "text",
                "text": text,
                "size": "md",
                "weight": "bold",
                "color": color,
                "align": "end",
                "flex": 1,
            },
        ],
    }


def _budget_panel(title: str, contents: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "borderColor": BRAND["line"],
        "borderWidth": "1px",
        "cornerRadius": "md",
        "paddingAll": "14px",
        "contents": [
            _plain_text(f"⠿  {title}", "sm", BRAND["black"], weight="bold"),
            *contents,
        ],
    }


def _budget_progress_row(label: str, amount: float, max_amount: float, color: str, *, suffix: str = "") -> dict[str, Any]:
    percent = 0 if max_amount <= 0 else min(max(amount / max_amount, 0), 1)
    return {
        "type": "box",
        "layout": "vertical",
        "spacing": "xs",
        "contents": [
            {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                    _plain_text(label, "sm", BRAND["black"], weight="bold", wrap=True),
                    {
                        "type": "text",
                        "text": f"฿{amount:,.0f}{suffix}",
                        "size": "sm",
                        "weight": "regular",
                        "color": color,
                        "align": "end",
                        "flex": 1,
                    },
                ],
            },
            {
                "type": "box",
                "layout": "vertical",
                "height": "6px",
                "backgroundColor": "#E5E7EB",
                "cornerRadius": "xxl",
                "contents": [
                    {
                        "type": "box",
                        "layout": "vertical",
                        "height": "6px",
                        "width": f"{max(round(percent * 100), 4)}%",
                        "backgroundColor": color,
                        "cornerRadius": "xxl",
                        "contents": [],
                    }
                ],
            },
        ],
    }


def _meta_row(label: str, value: str) -> dict[str, Any]:
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            _plain_text(label, "xs", BRAND["muted"]),
            {"type": "text", "text": value, "size": "xs", "color": BRAND["black"], "align": "end", "flex": 1},
        ],
    }


def _category_summary_rows(category_totals: dict[str, float]) -> list[dict[str, Any]]:
    rows = [
        _amount_row(_category_label(category), amount, BRAND["black"])
        for category, amount in sorted(category_totals.items(), key=lambda item: item[1], reverse=True)
        if amount > 0
    ]
    if rows:
        return rows[:10]
    return [_plain_text("ยังไม่มีรายจ่ายวันนี้", "sm", BRAND["muted"])]


def _format_thai_date(value: date) -> str:
    months = {
        1: "ม.ค.",
        2: "ก.พ.",
        3: "มี.ค.",
        4: "เม.ย.",
        5: "พ.ค.",
        6: "มิ.ย.",
        7: "ก.ค.",
        8: "ส.ค.",
        9: "ก.ย.",
        10: "ต.ค.",
        11: "พ.ย.",
        12: "ธ.ค.",
    }
    return f"{value.day} {months[value.month]} {value.year + 543}"


def _format_thai_datetime(value: date) -> str:
    return f"{_format_thai_date(value)}"


def _format_signed_baht(amount: float) -> str:
    sign = "+" if amount >= 0 else "-"
    return f"{sign}฿{abs(amount):,.0f}"


def _category_label(category: str) -> str:
    labels = {
        "Food": "อาหาร",
        "Transport": "เดินทาง",
        "Rent / Home": "ที่พัก",
        "Utilities": "ค่าน้ำค่าไฟ",
        "Debt Payment": "ผ่อนรถ/หนี้",
        "Shopping": "ชอปปิ้ง",
        "Health": "สุขภาพ",
        "Business Cost": "ต้นทุนธุรกิจ",
        "Other Expense": "อื่นๆ",
        "Salary": "เงินเดือน",
        "Freelance": "งานพิเศษ",
        "Business Revenue": "ธุรกิจส่วนตัว",
        "Other Income": "อื่นๆ",
    }
    return labels.get(category, category)
