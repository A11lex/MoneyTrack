import type {
  DashboardData,
  DailyReminderSettings,
  DailyReminderSettingsInput,
  LineUserInput,
  LineUserSetup,
  OnboardingInput,
  RecurringTransaction,
  RecurringTransactionInput,
  Transaction,
  TransactionInput,
  WhatIfResult,
  WhatIfScenario,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function withLineUser(path: string, lineUserId?: string): string {
  if (!lineUserId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}line_user_id=${encodeURIComponent(lineUserId)}`;
}

export function getDashboard(lineUserId?: string): Promise<DashboardData> {
  return request<DashboardData>(withLineUser("/dashboard", lineUserId));
}

export function getTransactions(lineUserId?: string): Promise<Transaction[]> {
  return request<Transaction[]>(withLineUser("/transactions", lineUserId));
}

export function getTransaction(id: number, lineUserId?: string): Promise<Transaction> {
  return request<Transaction>(withLineUser(`/transactions/${id}`, lineUserId));
}

export function createTransaction(payload: TransactionInput, lineUserId?: string): Promise<Transaction> {
  return request<Transaction>(withLineUser("/transactions", lineUserId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTransaction(id: number, payload: TransactionInput, lineUserId?: string): Promise<Transaction> {
  return request<Transaction>(withLineUser(`/transactions/${id}`, lineUserId), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTransaction(id: number, lineUserId?: string): Promise<void> {
  return request<void>(withLineUser(`/transactions/${id}`, lineUserId), { method: "DELETE" });
}

export function getRecurringTransactions(lineUserId: string): Promise<RecurringTransaction[]> {
  return request<RecurringTransaction[]>(withLineUser("/recurring-transactions", lineUserId));
}

export function createRecurringTransaction(payload: RecurringTransactionInput, lineUserId: string): Promise<RecurringTransaction> {
  return request<RecurringTransaction>(withLineUser("/recurring-transactions", lineUserId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRecurringTransaction(id: number, payload: RecurringTransactionInput, lineUserId: string): Promise<RecurringTransaction> {
  return request<RecurringTransaction>(withLineUser(`/recurring-transactions/${id}`, lineUserId), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteRecurringTransaction(id: number, lineUserId: string): Promise<void> {
  return request<void>(withLineUser(`/recurring-transactions/${id}`, lineUserId), { method: "DELETE" });
}

export function getDailyReminderSettings(lineUserId: string): Promise<DailyReminderSettings> {
  return request<DailyReminderSettings>(withLineUser("/daily-reminder-settings", lineUserId));
}

export function saveDailyReminderSettings(lineUserId: string, payload: DailyReminderSettingsInput): Promise<DailyReminderSettings> {
  return request<DailyReminderSettings>(withLineUser("/daily-reminder-settings", lineUserId), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function runWhatIf(payload: WhatIfScenario, lineUserId?: string): Promise<WhatIfResult> {
  return request<WhatIfResult>(withLineUser("/what-if", lineUserId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function upsertLineUser(payload: LineUserInput): Promise<LineUserSetup> {
  return request<LineUserSetup>("/users/line", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveLineUserOnboarding(lineUserId: string, payload: OnboardingInput): Promise<LineUserSetup> {
  return request<LineUserSetup>(`/users/line/${encodeURIComponent(lineUserId)}/onboarding`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
