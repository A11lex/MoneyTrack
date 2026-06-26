# MoneyTrack AI MVP Spec

## Goal

Create a finance dashboard for individuals and small businesses that explains money movement, risk, cashflow, end-of-month projections, and recommended next actions.

## Users

- Individuals tracking income, essential spending, savings, and debt
- Freelancers tracking mixed personal and business money
- Small-business owners monitoring revenue, operating costs, and cashflow

## Core Workflows

1. Add income or expense transaction.
2. Review dashboard summary.
3. Identify risky categories and cashflow pressure.
4. Read AI-style rule-based recommendations.
5. Run what-if scenario to see how changes affect net balance and risk.
6. Send a Thai natural-language transaction message to the mock LINE webhook.
7. Complete first-run LINE/LIFF onboarding with profile, categories, and budget setup.

## Data Model

Transaction:

- Date
- Type: income or expense
- Amount
- Category
- Description
- Mode: personal or business

## Financial Formulas

- Net balance = total income - total expense
- Savings rate = net balance / total income * 100
- Expense-to-income ratio = total expense / total income * 100
- Current month cashflow = current month income - current month expense
- Projected end-of-month balance = current month cashflow / elapsed days * days in month

## Advisor Rules

- Expenses above income create negative cashflow risk.
- Food above 30% of total expense triggers a spending warning.
- Debt above 35% of income triggers high debt risk.
- Savings below 10% triggers a savings warning.
- Business cost above 60% of business revenue triggers margin risk.

## Acceptance Criteria

- Users can create, edit, delete, and list transactions.
- Dashboard summary and charts update from backend data.
- Advisor returns structured recommendations.
- Mock LINE webhook can parse, save, and reply to transaction messages.
- LINE Messaging API-style event payloads can be adapted into the same transaction flow.
- LINE user onboarding can persist selected income categories, expense categories, and monthly budgets.
- What-if simulator returns original net, new net, savings improvement, and risk-level change.
- Financial health score returns score, risk level, and explanation.
- UI supports English and Thai labels.
- Frontend lint, typecheck, and production build pass.
- Backend tests pass for calculations, health score, advisor rules, and simulator.
