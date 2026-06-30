from datetime import date
from enum import Enum

from typing import Literal

from pydantic import BaseModel, Field


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


class TransactionMode(str, Enum):
    personal = "personal"
    business = "business"


INCOME_CATEGORIES = ["Salary", "Freelance", "Business Revenue", "Other Income"]
EXPENSE_CATEGORIES = [
    "Food",
    "Transport",
    "Rent / Home",
    "Utilities",
    "Debt Payment",
    "Shopping",
    "Health",
    "Business Cost",
    "Other Expense",
]


class TransactionBase(BaseModel):
    date: date
    type: TransactionType
    amount: float = Field(gt=0)
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=240)
    mode: TransactionMode


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(TransactionBase):
    pass


class Transaction(TransactionBase):
    id: int


class RecurringTransactionBase(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0)
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=240)
    mode: TransactionMode
    interval: Literal["daily", "weekly", "monthly", "yearly"] = "monthly"
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    month: int | None = Field(default=None, ge=1, le=12)
    notify_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class RecurringTransactionCreate(RecurringTransactionBase):
    pass


class RecurringTransactionUpdate(RecurringTransactionBase):
    pass


class RecurringTransaction(RecurringTransactionBase):
    id: int
    line_user_id: str
    last_run_date: date | None = None


class DailyReminderSettingsBase(BaseModel):
    enabled: bool = False
    reminder_time: str = Field(default="18:00", pattern=r"^\d{2}:\d{2}$")
    reminder_mode: Literal["missing_only", "daily"] = "missing_only"


class DailyReminderSettingsUpdate(DailyReminderSettingsBase):
    pass


class DailyReminderSettings(DailyReminderSettingsBase):
    line_user_id: str
    last_sent_date: date | None = None


class UserSettingsBase(BaseModel):
    memory_categorization_enabled: bool = False
    streak_notifications_enabled: bool = False
    timezone: str = Field(default="Asia/Bangkok", min_length=1, max_length=80)
    confirmation_show_details: bool = True
    confirmation_show_budget: bool = True
    confirmation_show_budget_warning: bool = True
    confirmation_show_payment_options: bool = False
    payment_channels: list[str] = Field(default_factory=list, max_length=10)


class UserSettingsUpdate(UserSettingsBase):
    pass


class UserSettings(UserSettingsBase):
    line_user_id: str


class CategoryMemoryMapping(BaseModel):
    id: int
    line_user_id: str
    keyword: str
    category: str
    type: TransactionType


class LineUserUpsert(BaseModel):
    line_user_id: str = Field(min_length=1, max_length=120)
    display_name: str = Field(default="", max_length=120)
    picture_url: str | None = Field(default=None, max_length=2048)


class OnboardingPayload(BaseModel):
    discovery_source: str | None = Field(default=None, max_length=80)
    expense_categories: list[str] = Field(default_factory=list)
    income_categories: list[str] = Field(default_factory=list)
    monthly_budgets: dict[str, float] = Field(default_factory=dict)
    budget_cycle: Literal["daily", "weekly", "monthly"] = "monthly"
    budget_start_day: int = Field(default=1, ge=1, le=31)
    merge_from_line_user_id: str | None = Field(default=None, max_length=120)


class UserSetup(BaseModel):
    line_user_id: str
    display_name: str
    picture_url: str | None = None
    onboarding_completed: bool
    discovery_source: str | None = None
    expense_categories: list[str]
    income_categories: list[str]
    monthly_budgets: dict[str, float]
    budget_cycle: Literal["daily", "weekly", "monthly"] = "monthly"
    budget_start_day: int = Field(default=1, ge=1, le=31)


class WhatIfScenario(BaseModel):
    reduce_food_percent: float = Field(default=0, ge=0, le=100)
    reduce_shopping_percent: float = Field(default=0, ge=0, le=100)
    increase_income_percent: float = Field(default=0, ge=0, le=100)
    reduce_debt_percent: float = Field(default=0, ge=0, le=100)
    reduce_business_cost_percent: float = Field(default=0, ge=0, le=100)
