from datetime import date
from enum import Enum

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


class WhatIfScenario(BaseModel):
    reduce_food_percent: float = Field(default=0, ge=0, le=100)
    reduce_shopping_percent: float = Field(default=0, ge=0, le=100)
    increase_income_percent: float = Field(default=0, ge=0, le=100)
    reduce_debt_percent: float = Field(default=0, ge=0, le=100)
    reduce_business_cost_percent: float = Field(default=0, ge=0, le=100)
